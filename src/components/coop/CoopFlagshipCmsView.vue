<template>
  <div class="space-y-5 sm:space-y-6 pb-6 sm:pb-8">
    <!-- HEADER BANNER -->
    <header class="card bg-base-100 border border-base-300 rounded-2xl shadow-sm p-4 sm:p-6">
      <div class="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div class="space-y-1.5 max-w-3xl">
          <div class="flex items-center gap-2 flex-wrap">
            <span class="badge badge-sm badge-primary text-primary-content font-extrabold whitespace-nowrap shrink-0">
              Headless Brand &amp; Events Studio
            </span>
            <span
              class="badge badge-sm font-mono font-bold whitespace-nowrap shrink-0"
              :class="hasUnsavedChanges ? 'badge-warning text-warning-content' : 'badge-success text-success-content'"
            >
              {{ hasUnsavedChanges ? 'Unsaved Edits' : 'Synced with Flagship Feed' }}
            </span>
            <span v-if="!canPublish && !loading" class="badge badge-sm badge-neutral text-neutral-content whitespace-nowrap shrink-0">
              Read-Only View (Founder, Promoter &amp; Builder Publish)
            </span>
          </div>
          <h1 class="text-2xl sm:text-3xl font-black tracking-tight text-base-content">
            Flagship &amp; Multi-Channel Events CMS
          </h1>
          <p class="text-xs sm:text-sm text-base-content/75 leading-relaxed">
            Manage public copy for <strong>thehc.llc/#works</strong>, active online storefronts, and upcoming
            <strong>Huckleberry-Hosted Pop-Ups</strong>, <strong>Partner Markets</strong>, &amp; <strong>Live Auctions</strong>—which
            also appear automatically as 1-tap Event Chips inside <strong>Record Sale</strong>.
          </p>
        </div>

        <div class="flex flex-wrap items-center gap-2 shrink-0">
          <a
            href="/api/public/flagship-content"
            target="_blank"
            rel="noopener noreferrer"
            class="btn btn-sm h-11 md:h-9 btn-outline rounded-xl font-bold gap-1.5"
          >
            <Icon icon="solar:code-file-bold-duotone" class="w-4 h-4 shrink-0" />
            <span>Live Public JSON</span>
          </a>
          <button
            v-if="canPublish"
            type="button"
            :disabled="saving || loading"
            class="btn btn-sm h-11 md:h-9 btn-ghost border border-base-300 rounded-xl font-bold gap-1.5"
            @click="handleResetDefaults"
          >
            <Icon icon="solar:restart-bold" class="w-4 h-4 shrink-0" />
            <span>Reset Defaults</span>
          </button>
        </div>
      </div>
    </header>

    <!-- TOP KPI SUMMARY STRIP -->
    <KpiStatGrid :items="kpiStats" :columns="4" />

    <!-- LOADING SKELETON (Doherty Bucket 2: Geometry-Matched Skeletons) -->
    <div v-if="loading" class="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div class="skeleton h-48 w-full rounded-2xl"></div>
      <div class="skeleton h-48 w-full rounded-2xl"></div>
    </div>

    <div v-else-if="loadError" class="alert alert-error rounded-2xl text-xs sm:text-sm flex items-center justify-between gap-3">
      <span>{{ loadError }}</span>
      <button type="button" class="btn btn-sm btn-outline rounded-xl font-bold" @click="loadCmsState">
        Retry
      </button>
    </div>

    <template v-else>
      <!-- 3 STUDIO TABS (<= 7 Pills per Choice Overload) -->
      <div class="flex flex-wrap items-center justify-between gap-2.5">
        <div role="tablist" class="join bg-base-200/70 p-1 rounded-2xl border border-base-300 flex-wrap">
          <button
            type="button"
            role="tab"
            class="join-item btn btn-sm h-11 md:h-9 rounded-xl font-bold gap-1.5"
            :class="activeTab === 'events' ? 'btn-neutral text-neutral-content shadow-xs' : 'btn-ghost'"
            @click="activeTab = 'events'"
          >
            <Icon icon="solar:calendar-mark-bold-duotone" class="w-4 h-4 shrink-0" />
            <span>Pop-Ups &amp; Live Events ({{ draft.events.length }})</span>
          </button>
          <button
            type="button"
            role="tab"
            class="join-item btn btn-sm h-11 md:h-9 rounded-xl font-bold gap-1.5"
            :class="activeTab === 'spotlight' ? 'btn-neutral text-neutral-content shadow-xs' : 'btn-ghost'"
            @click="activeTab = 'spotlight'"
          >
            <Icon icon="solar:magic-stick-3-bold-duotone" class="w-4 h-4 shrink-0" />
            <span>thehc.llc/#works Copy</span>
          </button>
          <button
            type="button"
            role="tab"
            class="join-item btn btn-sm h-11 md:h-9 rounded-xl font-bold gap-1.5"
            :class="activeTab === 'channels' ? 'btn-neutral text-neutral-content shadow-xs' : 'btn-ghost'"
            @click="activeTab = 'channels'"
          >
            <Icon icon="solar:shop-2-bold-duotone" class="w-4 h-4 shrink-0" />
            <span>Sales Channels ({{ draft.channels.length }})</span>
          </button>
        </div>

        <button
          v-if="activeTab === 'events' && canPublish"
          type="button"
          class="btn btn-sm h-11 md:h-9 btn-outline btn-secondary rounded-xl font-black gap-1.5"
          @click="openNewEventDrawer"
        >
          <Icon icon="solar:add-circle-bold" class="w-4 h-4 shrink-0" />
          <span>Add Event / Pop-Up</span>
        </button>

        <button
          v-else-if="activeTab === 'channels' && canPublish"
          type="button"
          class="btn btn-sm h-11 md:h-9 btn-outline btn-secondary rounded-xl font-black gap-1.5"
          @click="openNewChannelDrawer"
        >
          <Icon icon="solar:add-circle-bold" class="w-4 h-4 shrink-0" />
          <span>Add Sales Channel</span>
        </button>
      </div>

      <!-- TAB 1: POP-UPS, HOSTED EVENTS & LIVE DROPS -->
      <section v-if="activeTab === 'events'" class="space-y-4">
        <div class="rounded-2xl bg-base-200/60 border border-base-300 p-3.5 text-xs text-base-content/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div class="flex items-center gap-2">
            <Icon icon="solar:bolt-circle-bold" class="w-4 h-4 text-warning shrink-0" />
            <span>
              <strong>Marketing + Checkout Bridge:</strong> Every <code>live</code> or <code>upcoming</code> event (and past events within 14 days) automatically appears on <strong>thehc.llc</strong> AND as a 1-tap Event Chip inside <strong>Record Sale</strong>.
            </span>
          </div>
          <a href="/sales" class="font-bold text-primary hover:underline shrink-0">Open Sales Ledger →</a>
        </div>

        <div v-if="draft.events.length === 0" class="card bg-base-100 border border-dashed border-base-300 rounded-2xl p-8 text-center space-y-3">
          <div class="text-sm font-black text-base-content">No pop-ups, partner markets, or live streams listed yet</div>
          <p class="text-xs text-base-content/65 max-w-md mx-auto">
            Post Huckleberry-hosted pop-ups, partner markets/conventions, or Whatnot live drops so shoppers and Curators see what is coming next.
          </p>
          <div v-if="canPublish">
            <button type="button" class="btn btn-sm h-11 md:h-9 btn-outline rounded-xl font-bold" @click="openNewEventDrawer">
              + Add First Event
            </button>
          </div>
        </div>

        <div v-else class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          <article
            v-for="(ev, idx) in draft.events"
            :key="ev.id"
            class="card bg-base-100 border border-base-300 rounded-2xl shadow-sm p-4 sm:p-5 flex flex-col justify-between gap-4"
          >
            <div class="space-y-2.5">
              <div class="flex items-center justify-between gap-2 flex-wrap">
                <span class="badge badge-sm badge-secondary text-secondary-content font-bold whitespace-nowrap shrink-0">
                  {{ eventKindLabel(ev.eventKind) }}
                </span>
                <span
                  class="badge badge-sm font-bold whitespace-nowrap shrink-0"
                  :class="
                    ev.status === 'live'
                      ? 'badge-success text-success-content'
                      : ev.status === 'upcoming'
                        ? 'badge-primary text-primary-content'
                        : 'badge-ghost'
                  "
                >
                  {{ ev.status === 'live' ? '🔴 Live Now' : ev.status === 'upcoming' ? '📅 Upcoming' : 'Archived / Past' }}
                </span>
              </div>

              <h3 class="text-base font-black text-base-content leading-snug break-words">
                {{ ev.title }}
              </h3>

              <div class="space-y-1 text-xs text-base-content/75">
                <div class="flex items-center gap-1.5 font-semibold">
                  <Icon icon="solar:calendar-bold" class="w-3.5 h-3.5 text-primary shrink-0" />
                  <span>{{ ev.dateLabel }}</span>
                  <span v-if="ev.startDate" class="font-mono text-[11px] opacity-70">({{ ev.startDate }})</span>
                </div>
                <div class="flex items-center gap-1.5">
                  <Icon icon="solar:map-point-bold" class="w-3.5 h-3.5 text-secondary shrink-0" />
                  <span>{{ ev.locationLabel }}</span>
                </div>
                <div class="flex items-center gap-1.5 font-mono text-[11px] text-base-content/65">
                  <Icon icon="solar:tag-price-bold" class="w-3.5 h-3.5 shrink-0" />
                  <span>Checkout Preset Fee: {{ ev.defaultFeePct }}%</span>
                </div>
              </div>

              <p v-if="ev.summary" class="text-xs text-base-content/70 leading-relaxed break-words">
                {{ ev.summary }}
              </p>
            </div>

            <div class="flex items-center justify-between gap-2 pt-2 border-t border-base-200">
              <a
                v-if="ev.ctaUrl"
                :href="ev.ctaUrl"
                target="_blank"
                rel="noopener noreferrer"
                class="text-xs font-bold text-primary hover:underline truncate"
              >
                {{ ev.ctaLabel || 'Event Link' }} ↗
              </a>
              <span v-else class="text-[11px] text-base-content/50">No external URL</span>

              <div v-if="canPublish" class="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  class="btn btn-xs h-11 md:h-8 px-3 btn-outline rounded-xl font-bold"
                  @click="openEditEventDrawer(idx)"
                >
                  Edit
                </button>
                <button
                  type="button"
                  class="btn btn-xs h-11 md:h-8 px-2.5 btn-ghost text-error hover:bg-error/10 rounded-xl font-bold"
                  aria-label="Remove event"
                  @click="removeEvent(idx)"
                >
                  Delete
                </button>
              </div>
            </div>
          </article>
        </div>
      </section>

      <!-- TAB 2: THEHC.LLC/#WORKS SPOTLIGHT & 4 PILLARS (LAZY v-if) -->
      <section v-else-if="activeTab === 'spotlight'" class="grid grid-cols-1 xl:grid-cols-12 gap-5">
        <!-- Left Editor Form -->
        <div class="xl:col-span-7 space-y-5">
          <div class="card bg-base-100 border border-base-300 rounded-2xl p-4 sm:p-5 space-y-4">
            <h2 class="text-base font-black text-base-content">Hero Headline &amp; Multi-Channel Pitch</h2>

            <div class="space-y-3">
              <div class="form-control gap-1">
                <label class="text-xs font-bold text-base-content/80">Eyebrow Badge</label>
                <input
                  v-model="draft.worksSpotlight.eyebrow"
                  :disabled="!canPublish"
                  type="text"
                  maxlength="90"
                  class="input input-bordered input-sm h-10 w-full rounded-xl bg-base-100 text-xs font-mono"
                />
              </div>

              <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div class="form-control gap-1">
                  <label class="text-xs font-bold text-base-content/80">Headline Lead</label>
                  <input
                    v-model="draft.worksSpotlight.headlineLead"
                    :disabled="!canPublish"
                    type="text"
                    maxlength="60"
                    class="input input-bordered input-sm h-10 w-full rounded-xl bg-base-100 font-bold text-sm"
                  />
                </div>
                <div class="form-control gap-1">
                  <label class="text-xs font-bold text-base-content/80">Headline Accent (Orange Line)</label>
                  <input
                    v-model="draft.worksSpotlight.headlineAccent"
                    :disabled="!canPublish"
                    type="text"
                    maxlength="70"
                    class="input input-bordered input-sm h-10 w-full rounded-xl bg-base-100 font-bold text-sm text-primary"
                  />
                </div>
              </div>

              <div class="form-control gap-1">
                <label class="text-xs font-bold text-base-content/80">Subhead Paragraph</label>
                <textarea
                  v-model="draft.worksSpotlight.subhead"
                  :disabled="!canPublish"
                  rows="3"
                  maxlength="320"
                  class="textarea textarea-bordered w-full rounded-xl bg-base-100 text-xs leading-relaxed"
                ></textarea>
              </div>
            </div>
          </div>

          <!-- 3 Checklist Bullets inside Right Feature Card -->
          <div class="card bg-base-100 border border-base-300 rounded-2xl p-4 sm:p-5 space-y-4">
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div class="form-control gap-1">
                <label class="text-xs font-bold text-base-content/80">Spotlight Card Title</label>
                <input
                  v-model="draft.worksSpotlight.cardTitle"
                  :disabled="!canPublish"
                  type="text"
                  maxlength="40"
                  class="input input-bordered input-sm h-10 w-full rounded-xl bg-base-100 font-bold text-xs"
                />
              </div>
              <div class="form-control gap-1">
                <label class="text-xs font-bold text-base-content/80">Spotlight Card Subtitle</label>
                <input
                  v-model="draft.worksSpotlight.cardSubtitle"
                  :disabled="!canPublish"
                  type="text"
                  maxlength="60"
                  class="input input-bordered input-sm h-10 w-full rounded-xl bg-base-100 text-xs"
                />
              </div>
            </div>

            <div class="space-y-3">
              <div
                v-for="(bullet, bIdx) in draft.worksSpotlight.checklistBullets"
                :key="`bullet-${bIdx}`"
                class="p-3 rounded-xl bg-base-200/60 border border-base-300 space-y-2"
              >
                <div class="text-[11px] font-black uppercase tracking-wider text-base-content/60">
                  Card Checkmark #{{ bIdx + 1 }}
                </div>
                <input
                  v-model="bullet.lead"
                  :disabled="!canPublish"
                  type="text"
                  maxlength="70"
                  placeholder="Bold lead phrase..."
                  class="input input-bordered input-sm h-9 w-full rounded-xl bg-base-100 font-bold text-xs"
                />
                <textarea
                  v-model="bullet.body"
                  :disabled="!canPublish"
                  rows="2"
                  maxlength="220"
                  placeholder="Supporting explanation..."
                  class="textarea textarea-bordered w-full rounded-xl bg-base-100 text-xs"
                ></textarea>
              </div>
            </div>
          </div>

          <!-- 4 Feature Pillar Cards -->
          <div class="card bg-base-100 border border-base-300 rounded-2xl p-4 sm:p-5 space-y-4">
            <h2 class="text-base font-black text-base-content">4 Feature Pillar Cards</h2>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div
                v-for="(pillar, pIdx) in draft.worksSpotlight.pillars"
                :key="`pillar-${pIdx}`"
                class="p-3.5 rounded-xl bg-base-200/60 border border-base-300 space-y-2.5"
              >
                <div class="flex items-center gap-2">
                  <input
                    v-model="pillar.icon"
                    :disabled="!canPublish"
                    type="text"
                    maxlength="4"
                    class="input input-bordered input-xs w-12 h-9 rounded-lg text-center text-base bg-base-100"
                    title="Emoji icon"
                  />
                  <input
                    v-model="pillar.badge"
                    :disabled="!canPublish"
                    type="text"
                    maxlength="28"
                    class="input input-bordered input-xs flex-1 h-9 rounded-lg font-mono font-bold text-xs uppercase bg-base-100"
                    placeholder="PILLAR BADGE"
                  />
                </div>
                <input
                  v-model="pillar.title"
                  :disabled="!canPublish"
                  type="text"
                  maxlength="60"
                  class="input input-bordered input-sm h-9 w-full rounded-xl font-bold text-xs bg-base-100"
                  placeholder="Pillar title"
                />
                <textarea
                  v-model="pillar.description"
                  :disabled="!canPublish"
                  rows="3"
                  maxlength="240"
                  class="textarea textarea-bordered w-full rounded-xl text-xs bg-base-100 leading-relaxed"
                ></textarea>
              </div>
            </div>
          </div>
        </div>

        <!-- Right Live Flagship Preview -->
        <aside class="xl:col-span-5 space-y-4">
          <div class="rounded-3xl bg-neutral text-neutral-content p-5 sm:p-6 border border-base-300 shadow-lg space-y-5">
            <div class="flex items-center justify-between gap-2 flex-wrap">
              <span class="badge badge-xs badge-primary text-primary-content font-mono font-bold whitespace-nowrap shrink-0">
                LIVE PREVIEW • THEHC.LLC/#WORKS
              </span>
            </div>

            <div class="space-y-2.5">
              <div class="text-[10px] font-mono uppercase tracking-wider text-primary font-bold">
                {{ draft.worksSpotlight.eyebrow }}
              </div>
              <h3 class="text-2xl sm:text-3xl font-black leading-tight">
                <span class="block">{{ draft.worksSpotlight.headlineLead }}</span>
                <span class="block text-primary">{{ draft.worksSpotlight.headlineAccent }}</span>
              </h3>
              <p class="text-xs opacity-85 leading-relaxed">
                {{ draft.worksSpotlight.subhead }}
              </p>
            </div>

            <div class="rounded-2xl bg-base-100 text-base-content p-4 space-y-3 shadow-md">
              <div class="flex items-center justify-between gap-2 border-b border-base-200 pb-2.5">
                <div>
                  <div class="font-black text-sm">{{ draft.worksSpotlight.cardTitle }}</div>
                  <div class="text-[11px] text-base-content/65">{{ draft.worksSpotlight.cardSubtitle }}</div>
                </div>
                <span class="badge badge-xs badge-primary text-primary-content font-bold whitespace-nowrap shrink-0">
                  @TheHC
                </span>
              </div>
              <ul class="space-y-2 text-xs">
                <li
                  v-for="(b, idx) in draft.worksSpotlight.checklistBullets"
                  :key="`prev-b-${idx}`"
                  class="flex items-start gap-2 leading-snug"
                >
                  <span class="text-primary font-black shrink-0">✓</span>
                  <span><strong>{{ b.lead }}</strong> {{ b.body }}</span>
                </li>
              </ul>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div
                v-for="(p, idx) in draft.worksSpotlight.pillars"
                :key="`prev-p-${idx}`"
                class="rounded-2xl bg-neutral-content/10 border border-neutral-content/15 p-3 space-y-1.5"
              >
                <div class="flex items-center justify-between gap-1.5">
                  <span class="text-base">{{ p.icon }}</span>
                  <span class="badge badge-2xs badge-primary text-primary-content font-mono font-bold whitespace-nowrap shrink-0">
                    {{ p.badge }}
                  </span>
                </div>
                <div class="font-black text-xs">{{ p.title }}</div>
                <p class="text-[11px] opacity-80 leading-snug">{{ p.description }}</p>
              </div>
            </div>
          </div>
        </aside>
      </section>

      <!-- TAB 3: SALES CHANNEL & STOREFRONT DIRECTORY (LAZY v-if) -->
      <section v-else-if="activeTab === 'channels'" class="space-y-4">
        <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          <article
            v-for="(chan, idx) in draft.channels"
            :key="chan.id"
            class="card bg-base-100 border border-base-300 rounded-2xl shadow-sm p-4 sm:p-5 flex flex-col justify-between gap-4"
          >
            <div class="space-y-2">
              <div class="flex items-center justify-between gap-2 flex-wrap">
                <span class="badge badge-sm badge-primary text-primary-content font-bold whitespace-nowrap shrink-0">
                  {{ channelCategoryLabel(chan.category) }}
                </span>
                <span
                  class="badge badge-sm font-bold whitespace-nowrap shrink-0"
                  :class="chan.active ? 'badge-success text-success-content' : 'badge-ghost'"
                >
                  {{ chan.badge }}
                </span>
              </div>
              <h3 class="text-base font-black text-base-content leading-snug">{{ chan.name }}</h3>
              <p class="text-xs text-base-content/75 leading-relaxed">{{ chan.summary }}</p>
            </div>

            <div class="flex items-center justify-between gap-2 pt-2 border-t border-base-200">
              <a
                v-if="chan.url"
                :href="chan.url"
                target="_blank"
                rel="noopener noreferrer"
                class="text-xs font-bold text-primary hover:underline truncate"
              >
                {{ chan.url.replace(/^https:\/\//, '') }} ↗
              </a>
              <span v-else class="text-[11px] text-base-content/50">In-person / internal</span>

              <div v-if="canPublish" class="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  class="btn btn-xs h-11 md:h-8 px-3 btn-outline rounded-xl font-bold"
                  @click="openEditChannelDrawer(idx)"
                >
                  Edit
                </button>
                <button
                  type="button"
                  class="btn btn-xs h-11 md:h-8 px-2.5 btn-ghost text-error hover:bg-error/10 rounded-xl font-bold"
                  @click="removeChannel(idx)"
                >
                  Delete
                </button>
              </div>
            </div>
          </article>
        </div>
      </section>
    </template>

    <!-- EVENT CREATE / EDIT SLIDE-OVER DRAWER (Jakob's Law + Postel's Law + Zero-PII Warning) -->
    <SlideOverDrawer
      v-model="eventDrawerOpen"
      :title="editingEventIndex !== null ? 'Edit Event / Pop-Up' : 'Add Event, Pop-Up or Live Drop'"
      subtitle="Published events sync to thehc.llc and unlock 1-tap Event Checkout in Record Sale."
    >
      <div class="space-y-4">
        <div class="form-control gap-1.5">
          <label class="text-xs font-bold text-base-content/80">Event Type</label>
          <div class="grid grid-cols-1 gap-1.5">
            <button
              v-for="opt in eventKindOptions"
              :key="opt.value"
              type="button"
              class="btn btn-sm h-11 justify-between rounded-xl font-bold"
              :class="
                eventForm.eventKind === opt.value
                  ? 'btn-secondary text-secondary-content'
                  : 'btn-ghost bg-base-200/60 border border-base-300'
              "
              @click="selectEventFormKind(opt.value)"
            >
              <span>{{ opt.label }}</span>
              <span class="badge badge-xs font-mono font-bold whitespace-nowrap shrink-0">
                Default {{ opt.defaultFeePct }}%
              </span>
            </button>
          </div>
        </div>

        <div class="form-control gap-1">
          <label class="text-xs font-bold text-base-content/80">Event Title</label>
          <input
            v-model="eventForm.title"
            type="text"
            maxlength="90"
            placeholder="e.g. PDX Night Market Pop-Up or Whatnot RPG Boxed Set Drop"
            class="input input-bordered input-sm h-10 w-full rounded-xl bg-base-100 font-bold text-sm"
          />
        </div>

        <div class="grid grid-cols-3 gap-2">
          <button
            v-for="st in (['upcoming', 'live', 'past'] as const)"
            :key="st"
            type="button"
            class="btn btn-xs h-10 rounded-xl font-bold capitalize"
            :class="
              eventForm.status === st
                ? 'btn-neutral text-neutral-content'
                : 'btn-ghost bg-base-200/60 border border-base-300'
            "
            @click="eventForm.status = st"
          >
            {{ st === 'live' ? '🔴 Live' : st === 'upcoming' ? '📅 Upcoming' : 'Past' }}
          </button>
        </div>

        <div class="form-control gap-1">
          <label class="text-xs font-bold text-base-content/80">Display Date / Time Label</label>
          <input
            v-model="eventForm.dateLabel"
            type="text"
            maxlength="70"
            placeholder="e.g. Sat Nov 21 • 11am–5pm PT"
            class="input input-bordered input-sm h-10 w-full rounded-xl bg-base-100 text-xs font-semibold"
          />
        </div>

        <div class="grid grid-cols-2 gap-2.5">
          <div class="form-control gap-1">
            <label class="text-xs font-bold text-base-content/80">Start Date (Optional)</label>
            <input
              v-model="eventForm.startDate"
              type="date"
              class="input input-bordered input-sm h-10 w-full rounded-xl bg-base-100 font-mono text-xs"
            />
          </div>
          <div class="form-control gap-1">
            <label class="text-xs font-bold text-base-content/80">End Date (Optional)</label>
            <input
              v-model="eventForm.endDate"
              type="date"
              class="input input-bordered input-sm h-10 w-full rounded-xl bg-base-100 font-mono text-xs"
            />
          </div>
        </div>

        <div class="form-control gap-1">
          <label class="text-xs font-bold text-base-content/80">Public Venue / City / Platform Label</label>
          <input
            v-model="eventForm.locationLabel"
            type="text"
            maxlength="80"
            placeholder="e.g. SE Portland, OR • Oregon Convention Center • Whatnot Live"
            class="input input-bordered input-sm h-10 w-full rounded-xl bg-base-100 text-xs font-semibold"
          />
          <span class="text-[11px] text-warning font-semibold leading-snug">
            Privacy rule: Public city, neighborhood, market venue, or stream platform ONLY — never enter private home street addresses.
          </span>
        </div>

        <div class="grid grid-cols-2 gap-2.5">
          <div class="form-control gap-1">
            <label class="text-xs font-bold text-base-content/80">Default Checkout Fee (%)</label>
            <input
              v-model="eventFeeInput"
              type="text"
              inputmode="decimal"
              placeholder="2.9"
              class="input input-bordered input-sm h-10 w-full rounded-xl bg-base-100 font-mono font-bold text-xs"
            />
          </div>
          <div class="form-control gap-1">
            <label class="text-xs font-bold text-base-content/80">Button Label</label>
            <input
              v-model="eventForm.ctaLabel"
              type="text"
              maxlength="36"
              placeholder="RSVP / Follow"
              class="input input-bordered input-sm h-10 w-full rounded-xl bg-base-100 text-xs"
            />
          </div>
        </div>

        <div class="form-control gap-1">
          <label class="text-xs font-bold text-base-content/80">Event / Stream URL (https:// only)</label>
          <input
            v-model="eventForm.ctaUrl"
            type="url"
            placeholder="https://whatnot.com/invite/huckfinds"
            class="input input-bordered input-sm h-10 w-full rounded-xl bg-base-100 text-xs font-mono"
          />
          <span v-if="eventUrlWarning" class="text-[11px] text-error font-semibold">
            {{ eventUrlWarning }}
          </span>
        </div>

        <div class="form-control gap-1">
          <label class="text-xs font-bold text-base-content/80">Short Description</label>
          <textarea
            v-model="eventForm.summary"
            rows="3"
            maxlength="240"
            placeholder="What are we bringing or streaming?"
            class="textarea textarea-bordered w-full rounded-xl bg-base-100 text-xs leading-relaxed"
          ></textarea>
        </div>
      </div>

      <template #footer>
        <div class="flex items-center justify-end gap-2">
          <button type="button" class="btn btn-sm h-11 md:h-9 btn-ghost rounded-xl font-bold" @click="eventDrawerOpen = false">
            Cancel
          </button>
          <button
            type="button"
            :disabled="!eventForm.title.trim() || Boolean(eventUrlWarning)"
            class="btn btn-sm h-11 md:h-9 btn-primary text-primary-content rounded-xl font-black px-4 shadow-sm"
            @click="applyEventDrawerSave"
          >
            {{ editingEventIndex !== null ? 'Update Event' : 'Add to Schedule' }}
          </button>
        </div>
      </template>
    </SlideOverDrawer>

    <!-- SALES CHANNEL DRAWER -->
    <SlideOverDrawer
      v-model="channelDrawerOpen"
      :title="editingChannelIndex !== null ? 'Edit Sales Channel' : 'Add Sales Channel'"
      subtitle="Highlight every way The Huckleberry Collective sells online and in person."
    >
      <div class="space-y-4">
        <div class="form-control gap-1">
          <label class="text-xs font-bold text-base-content/80">Channel Category</label>
          <select
            v-model="channelForm.category"
            class="select select-bordered select-sm h-10 w-full rounded-xl bg-base-100 text-xs font-bold"
          >
            <option value="online">🌐 Online Marketplace / Live Auctions</option>
            <option value="hosted_events">🎪 Events &amp; Pop-Ups Hosted by Us</option>
            <option value="partner_events">🤝 Partner Markets, Cons &amp; Swaps</option>
            <option value="retail_booths">🏪 Permanent Retail Booths</option>
          </select>
        </div>

        <div class="form-control gap-1">
          <label class="text-xs font-bold text-base-content/80">Channel / Storefront Name</label>
          <input
            v-model="channelForm.name"
            type="text"
            maxlength="80"
            placeholder="e.g. Whatnot Live Auctions"
            class="input input-bordered input-sm h-10 w-full rounded-xl bg-base-100 font-bold text-sm"
          />
        </div>

        <div class="form-control gap-1">
          <label class="text-xs font-bold text-base-content/80">Badge Label</label>
          <input
            v-model="channelForm.badge"
            type="text"
            maxlength="40"
            placeholder="e.g. Live Auctions • Worldwide"
            class="input input-bordered input-sm h-10 w-full rounded-xl bg-base-100 text-xs font-semibold"
          />
        </div>

        <div class="form-control gap-1">
          <label class="text-xs font-bold text-base-content/80">Public Link (https:// only, optional)</label>
          <input
            v-model="channelForm.url"
            type="url"
            placeholder="https://..."
            class="input input-bordered input-sm h-10 w-full rounded-xl bg-base-100 text-xs font-mono"
          />
          <span v-if="channelUrlWarning" class="text-[11px] text-error font-semibold">
            {{ channelUrlWarning }}
          </span>
        </div>

        <div class="form-control gap-1">
          <label class="text-xs font-bold text-base-content/80">Summary</label>
          <textarea
            v-model="channelForm.summary"
            rows="3"
            maxlength="220"
            class="textarea textarea-bordered w-full rounded-xl bg-base-100 text-xs leading-relaxed"
          ></textarea>
        </div>

        <label class="label cursor-pointer justify-start gap-2.5">
          <input v-model="channelForm.active" type="checkbox" class="checkbox checkbox-sm checkbox-primary rounded" />
          <span class="label-text text-xs font-bold">Show on Public Flagship Feed</span>
        </label>
      </div>

      <template #footer>
        <div class="flex items-center justify-end gap-2">
          <button type="button" class="btn btn-sm h-11 md:h-9 btn-ghost rounded-xl font-bold" @click="channelDrawerOpen = false">
            Cancel
          </button>
          <button
            type="button"
            :disabled="!channelForm.name.trim() || Boolean(channelUrlWarning)"
            class="btn btn-sm h-11 md:h-9 btn-primary text-primary-content rounded-xl font-black px-4 shadow-sm"
            @click="applyChannelDrawerSave"
          >
            {{ editingChannelIndex !== null ? 'Update Channel' : 'Add Channel' }}
          </button>
        </div>
      </template>
    </SlideOverDrawer>

    <!-- STICKY BOTTOM ACTION DOCK (Law 5 Self-Clearing + Law 6 Synchronous Save Lock) -->
    <BottomActionDock>
      <template #left>
        <div class="flex items-center gap-2 text-xs min-w-0">
          <Icon
            :icon="hasUnsavedChanges ? 'solar:pen-new-square-bold' : 'solar:check-circle-bold'"
            class="w-4 h-4 shrink-0"
            :class="hasUnsavedChanges ? 'text-warning' : 'text-success'"
          />
          <span class="font-bold truncate">
            {{
              hasUnsavedChanges
                ? 'Unpublished edits ready to sync to thehc.llc & Record Sale'
                : lastSavedLabel
            }}
          </span>
        </div>
      </template>

      <template #right>
        <button
          v-if="hasUnsavedChanges && canPublish"
          type="button"
          :disabled="saving"
          class="btn btn-sm h-11 md:h-10 btn-ghost border border-base-300 rounded-2xl font-bold"
          @click="discardLocalEdits"
        >
          Discard
        </button>

        <button
          v-if="canPublish"
          type="button"
          :disabled="saving || loading || !hasUnsavedChanges"
          class="btn btn-sm sm:btn-md h-11 rounded-2xl font-black gap-1.5 px-5"
          :class="
            saving || loading || !hasUnsavedChanges
              ? 'bg-base-300/40 text-base-content/40 border border-base-content/10 cursor-not-allowed shadow-none'
              : 'btn-success text-success-content shadow-md'
          "
          @click="publishCmsChanges"
        >
          <span v-if="saving" class="loading loading-spinner loading-xs"></span>
          <Icon v-else icon="solar:cloud-upload-bold" class="w-4 h-4 shrink-0" />
          <span>{{ saving ? 'Publishing...' : 'Save & Publish Live' }}</span>
        </button>
      </template>
    </BottomActionDock>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { Icon } from '@iconify/vue';
import BottomActionDock from '../common/BottomActionDock.vue';
import KpiStatGrid, { type KpiStatItem } from '../common/KpiStatGrid.vue';
import SlideOverDrawer from '../common/SlideOverDrawer.vue';
import { getCoopJwtHeaders } from '../../lib/coopLedgerClient';
import { parsePriceValue } from '../../lib/lot-strategy';
import {
  DEFAULT_FLAGSHIP_CMS_CONTENT,
  EVENT_KIND_META,
  normalizeFlagshipChannel,
  normalizeFlagshipCmsContent,
  normalizePublicEvent,
  sanitizeHttpsUrl,
  type CoopEventKind,
  type CoopPublicEvent,
  type FlagshipChannelCategory,
  type FlagshipChannelDirectoryItem,
  type FlagshipCmsContent,
} from '../../lib/flagshipContent';
import { confirmDialog } from '../../stores/confirm';
import { addToast } from '../../stores/toast';

const cloneCms = (src: FlagshipCmsContent): FlagshipCmsContent =>
  normalizeFlagshipCmsContent(JSON.parse(JSON.stringify(src)));

const loading = ref(true);
const saving = ref(false);
const loadError = ref('');
const canPublish = ref(false);
const activeTab = ref<'events' | 'spotlight' | 'channels'>('events');

const savedSnapshot = ref<FlagshipCmsContent>(cloneCms(DEFAULT_FLAGSHIP_CMS_CONTENT));
const draft = ref<FlagshipCmsContent>(cloneCms(DEFAULT_FLAGSHIP_CMS_CONTENT));

const eventDrawerOpen = ref(false);
const editingEventIndex = ref<number | null>(null);
const eventFeeInput = ref('2.9');
const eventForm = ref<CoopPublicEvent>(
  normalizePublicEvent({
    id: '',
    title: '',
    eventKind: 'hosted_by_us',
    status: 'upcoming',
    dateLabel: '',
    startDate: '',
    endDate: '',
    locationLabel: 'Portland, OR',
    summary: '',
    ctaLabel: 'Details',
    ctaUrl: '',
    defaultFeePct: 2.9,
  })
);

const channelDrawerOpen = ref(false);
const editingChannelIndex = ref<number | null>(null);
const channelForm = ref<FlagshipChannelDirectoryItem>(
  normalizeFlagshipChannel({
    id: '',
    category: 'online',
    name: '',
    badge: 'Active',
    summary: '',
    url: '',
    active: true,
  })
);

const eventKindOptions: Array<{ value: CoopEventKind; label: string; defaultFeePct: number }> = [
  { value: 'hosted_by_us', label: EVENT_KIND_META.hosted_by_us.label, defaultFeePct: EVENT_KIND_META.hosted_by_us.defaultFeePct },
  { value: 'partner_event', label: EVENT_KIND_META.partner_event.label, defaultFeePct: EVENT_KIND_META.partner_event.defaultFeePct },
  { value: 'online_live', label: EVENT_KIND_META.online_live.label, defaultFeePct: EVENT_KIND_META.online_live.defaultFeePct },
];

const comparableJson = (c: FlagshipCmsContent) =>
  JSON.stringify({ ...c, updatedAt: '' });

const hasUnsavedChanges = computed(
  () => comparableJson(draft.value) !== comparableJson(savedSnapshot.value)
);

const activeEventsCount = computed(
  () => draft.value.events.filter((e) => e.status === 'live' || e.status === 'upcoming').length
);

const hostedEventsCount = computed(
  () => draft.value.events.filter((e) => e.eventKind === 'hosted_by_us').length
);

const activeChannelsCount = computed(
  () => draft.value.channels.filter((c) => c.active).length
);

const lastSavedLabel = computed(() => {
  if (!savedSnapshot.value.updatedAt) {
    return 'Serving default multi-channel copy • Click Save & Publish to persist custom edits';
  }
  return `Published ${savedSnapshot.value.updatedAt.slice(0, 16).replace('T', ' ')} UTC`;
});

const kpiStats = computed<KpiStatItem[]>(() => [
  {
    label: 'Active / Upcoming Drops',
    value: String(activeEventsCount.value),
    hint: `${hostedEventsCount.value} hosted by TheHC • ${draft.value.events.length} total`,
    badge: '1-Tap Sale Chips',
    badgeClass: 'badge-primary text-primary-content',
  },
  {
    label: 'Active Sales Channels',
    value: String(activeChannelsCount.value),
    hint: 'Online, our pop-ups, partner markets & booths',
    badge: 'Multi-Channel',
    badgeClass: 'badge-success text-success-content',
  },
  {
    label: 'thehc.llc/#works Feed',
    value: savedSnapshot.value.updatedAt ? 'Live CMS' : 'Ready',
    hint: '60s edge cache + offline siteConfig fallback',
    icon: 'solar:globus-bold-duotone',
    tone: 'text-info',
  },
  {
    label: 'Payload Footprint',
    value: `${(JSON.stringify(draft.value).length / 1000).toFixed(1)} KB`,
    hint: 'Under 60 KB Appwrite manifest cap',
    icon: 'solar:database-bold-duotone',
    tone: 'text-secondary',
  },
]);

const eventUrlWarning = computed(() => {
  const raw = eventForm.value.ctaUrl.trim();
  if (!raw) return '';
  return sanitizeHttpsUrl(raw) ? '' : 'External links must begin with https://';
});

const channelUrlWarning = computed(() => {
  const raw = channelForm.value.url.trim();
  if (!raw) return '';
  return sanitizeHttpsUrl(raw) ? '' : 'External links must begin with https://';
});

const eventKindLabel = (kind: CoopEventKind): string => EVENT_KIND_META[kind]?.label || '🎪 Event';

const channelCategoryLabel = (cat: FlagshipChannelCategory): string => {
  if (cat === 'hosted_events') return '🎪 Hosted by Us';
  if (cat === 'partner_events') return '🤝 Partner Event';
  if (cat === 'retail_booths') return '🏪 Retail Booths';
  return '🌐 Online';
};

const loadCmsState = async () => {
  loading.value = true;
  loadError.value = '';
  try {
    const headers = await getCoopJwtHeaders();
    const res = await fetch('/api/coop/flagship-cms', { method: 'GET', headers });
    const body = await res.json().catch(() => null);
    if (!res.ok) {
      throw new Error(body?.error || `Failed to load Flagship CMS (${res.status})`);
    }
    canPublish.value = Boolean(body?.canPublish);
    const normalized = normalizeFlagshipCmsContent(body?.content);
    savedSnapshot.value = cloneCms(normalized);
    draft.value = cloneCms(normalized);
  } catch (err: any) {
    loadError.value = err?.message || 'Unable to load Flagship CMS state.';
  } finally {
    loading.value = false;
  }
};

const selectEventFormKind = (kind: CoopEventKind) => {
  eventForm.value.eventKind = kind;
  const presetFee = EVENT_KIND_META[kind].defaultFeePct;
  eventForm.value.defaultFeePct = presetFee;
  eventFeeInput.value = String(presetFee);
};

const openNewEventDrawer = () => {
  editingEventIndex.value = null;
  eventFeeInput.value = '2.9';
  eventForm.value = normalizePublicEvent({
    id: `evt-${Date.now().toString(36)}`,
    title: '',
    eventKind: 'hosted_by_us',
    status: 'upcoming',
    dateLabel: '',
    startDate: '',
    endDate: '',
    locationLabel: 'Portland, OR',
    summary: '',
    ctaLabel: 'Details',
    ctaUrl: '',
    defaultFeePct: 2.9,
  });
  eventForm.value.title = '';
  eventForm.value.dateLabel = '';
  eventDrawerOpen.value = true;
};

const openEditEventDrawer = (idx: number) => {
  const target = draft.value.events[idx];
  if (!target) return;
  editingEventIndex.value = idx;
  eventForm.value = JSON.parse(JSON.stringify(target));
  eventFeeInput.value = String(target.defaultFeePct ?? 2.9);
  eventDrawerOpen.value = true;
};

const applyEventDrawerSave = () => {
  const parsedFee = Math.min(50, Math.max(0, parsePriceValue(eventFeeInput.value, 'first', 0)));
  const cleaned = normalizePublicEvent(
    {
      ...eventForm.value,
      defaultFeePct: parsedFee,
    },
    editingEventIndex.value ?? draft.value.events.length
  );

  if (editingEventIndex.value !== null) {
    draft.value.events.splice(editingEventIndex.value, 1, cleaned);
  } else {
    draft.value.events.unshift(cleaned);
  }
  eventDrawerOpen.value = false;
};

const removeEvent = async (idx: number) => {
  const target = draft.value.events[idx];
  if (!target) return;
  const ok = await confirmDialog(
    `Remove "${target.title}" from the schedule? Click "Save & Publish Live" afterward to update the public feed.`,
    'Remove Event',
    'Remove',
    'Cancel',
    'btn-error'
  );
  if (!ok) return;
  draft.value.events.splice(idx, 1);
};

const openNewChannelDrawer = () => {
  editingChannelIndex.value = null;
  channelForm.value = {
    id: `chan-${Date.now().toString(36)}`,
    category: 'online',
    name: '',
    badge: 'Active',
    summary: '',
    url: '',
    active: true,
  };
  channelDrawerOpen.value = true;
};

const openEditChannelDrawer = (idx: number) => {
  const target = draft.value.channels[idx];
  if (!target) return;
  editingChannelIndex.value = idx;
  channelForm.value = JSON.parse(JSON.stringify(target));
  channelDrawerOpen.value = true;
};

const applyChannelDrawerSave = () => {
  const cleaned = normalizeFlagshipChannel(
    channelForm.value,
    editingChannelIndex.value ?? draft.value.channels.length
  );
  if (editingChannelIndex.value !== null) {
    draft.value.channels.splice(editingChannelIndex.value, 1, cleaned);
  } else {
    draft.value.channels.push(cleaned);
  }
  channelDrawerOpen.value = false;
};

const removeChannel = async (idx: number) => {
  const target = draft.value.channels[idx];
  if (!target) return;
  const ok = await confirmDialog(
    `Remove "${target.name}" from the sales channel directory?`,
    'Remove Sales Channel',
    'Remove',
    'Cancel',
    'btn-error'
  );
  if (!ok) return;
  draft.value.channels.splice(idx, 1);
};

const discardLocalEdits = () => {
  draft.value = cloneCms(savedSnapshot.value);
  addToast('Discarded unpublished edits', 'info');
};

const publishCmsChanges = async () => {
  if (saving.value || !canPublish.value) return;
  saving.value = true;
  try {
    const headers = await getCoopJwtHeaders();
    const res = await fetch('/api/coop/flagship-cms', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        mode: 'save',
        content: draft.value,
      }),
    });
    const body = await res.json().catch(() => null);
    if (!res.ok) {
      throw new Error(body?.error || `Publish failed (${res.status})`);
    }
    const saved = normalizeFlagshipCmsContent(body?.content);
    savedSnapshot.value = cloneCms(saved);
    draft.value = cloneCms(saved);
    addToast('✅ Published live to Flagship Feed & Record Sale Event Chips', 'success');
  } catch (err: any) {
    addToast(err?.message || 'Failed to publish Flagship CMS changes.', 'error');
  } finally {
    saving.value = false;
  }
};

const handleResetDefaults = async () => {
  if (saving.value || !canPublish.value) return;
  const ok = await confirmDialog(
    'Restore the default multi-channel copy, channels, and sample events? This will publish immediately.',
    'Reset Flagship CMS to Defaults',
    'Reset & Publish',
    'Cancel',
    'btn-warning'
  );
  if (!ok) return;

  saving.value = true;
  try {
    const headers = await getCoopJwtHeaders();
    const res = await fetch('/api/coop/flagship-cms', {
      method: 'POST',
      headers,
      body: JSON.stringify({ mode: 'reset_defaults' }),
    });
    const body = await res.json().catch(() => null);
    if (!res.ok) {
      throw new Error(body?.error || `Reset failed (${res.status})`);
    }
    const saved = normalizeFlagshipCmsContent(body?.content);
    savedSnapshot.value = cloneCms(saved);
    draft.value = cloneCms(saved);
    addToast('↺ Restored sales-first multi-channel defaults', 'success');
  } catch (err: any) {
    addToast(err?.message || 'Failed to reset Flagship CMS.', 'error');
  } finally {
    saving.value = false;
  }
};

onMounted(() => {
  loadCmsState();
});
</script>

<template>
  <CollectiveAccessGate>
  <div class="space-y-5 sm:space-y-6 pb-6 sm:pb-8">
    <!-- HEADER -->
    <header class="card bg-base-100 border border-base-300 rounded-2xl shadow-sm p-4 sm:p-6">
      <div class="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div class="space-y-1.5 max-w-3xl">
          <div class="flex items-center gap-2 flex-wrap">
            <span class="badge badge-sm badge-primary text-primary-content font-extrabold whitespace-nowrap shrink-0">
              Cross-Posting &amp; Link Tracker
            </span>
            <span
              class="badge badge-sm font-mono font-bold whitespace-nowrap shrink-0"
              :class="saving ? 'badge-warning text-warning-content' : 'badge-success text-success-content'"
            >
              {{ saving ? 'Saving…' : '✅ Saved' }}
            </span>
            <span class="badge badge-sm badge-outline font-mono font-bold whitespace-nowrap shrink-0">
              🔒 Official Ledger
            </span>
          </div>
          <h1 class="text-2xl sm:text-3xl font-black tracking-tight text-base-content">
            Social Cross-Post &amp; Promo Tracker
          </h1>
          <p class="text-xs sm:text-sm text-base-content/75 leading-relaxed">
            Film and edit natively in TikTok, Instagram, or Whatnot—use this board to grab plain item/event facts, track which channels still need cross-posting, save live post links, and log verified Promoter hours.
          </p>
        </div>

        <div class="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            class="btn btn-sm h-11 md:h-9 btn-outline btn-primary rounded-xl font-black gap-1.5 px-4"
            @click="openNewCampaignDrawer"
          >
            <Icon icon="solar:add-circle-bold" class="w-4 h-4 shrink-0" />
            <span>+ New Promo / Drop</span>
          </button>
          <a
            href="/coop/cms"
            class="btn btn-sm h-11 md:h-9 btn-outline rounded-xl font-bold gap-1.5"
          >
            <Icon icon="solar:calendar-mark-bold-duotone" class="w-4 h-4 shrink-0" />
            <span>Events Schedule</span>
          </a>
          <a
            href="/social?legacyStudio=1"
            class="btn btn-sm h-11 md:h-9 btn-ghost border border-base-300 rounded-xl font-semibold text-xs gap-1.5"
            title="Open the parked legacy slide studio"
          >
            <Icon icon="solar:archive-minimalistic-linear" class="w-4 h-4 shrink-0" />
            <span>Parked Slide Studio</span>
          </a>
        </div>
      </div>
    </header>

    <!-- KPI SUMMARY -->
    <KpiStatGrid :items="kpiStats" :columns="4" />

    <!-- 1-TAP SEED STRIP FROM SCHEDULED EVENTS -->
    <section
      v-if="untrackedEvents.length > 0"
      class="rounded-2xl bg-base-200/60 border border-base-300 p-3.5 sm:p-4 space-y-2.5"
    >
      <div class="flex items-center justify-between gap-2 flex-wrap">
        <div class="text-xs font-black uppercase tracking-wider text-base-content/75 flex items-center gap-1.5">
          <Icon icon="solar:bolt-circle-bold" class="w-4 h-4 text-warning shrink-0" />
          <span>1-Tap Seed Promo from Scheduled Events</span>
        </div>
        <span class="text-[11px] text-base-content/60">Creates a pre-filled Cross-Post row + Fact Sheet</span>
      </div>
      <div class="flex flex-wrap gap-2">
        <button
          v-for="ev in untrackedEvents.slice(0, 5)"
          :key="ev.id"
          type="button"
          :disabled="saving"
          class="btn btn-sm h-11 md:h-8 btn-outline bg-base-100 rounded-xl font-bold gap-1.5"
          @click="seedFromEvent(ev)"
        >
          <span>{{ ev.eventKind === 'hosted_by_us' ? '🎪' : ev.eventKind === 'partner_event' ? '🤝' : '📡' }}</span>
          <span class="truncate max-w-52">{{ ev.title }}</span>
          <span class="badge badge-2xs badge-primary text-primary-content font-bold whitespace-nowrap shrink-0">+ Track</span>
        </button>
      </div>
    </section>

    <!-- FILTER TABS (<= 4 Pills) -->
    <div ref="tabSectionRef" class="scroll-mt-20 flex flex-wrap items-center justify-between gap-2.5">
      <div role="tablist" class="join bg-base-200/70 p-1 rounded-2xl border border-base-300 flex-wrap">
        <button
          v-for="tab in filterTabs"
          :key="tab.id"
          type="button"
          role="tab"
          class="join-item btn btn-sm h-11 md:h-9 rounded-xl font-bold gap-1.5"
          :class="activeFilter === tab.id ? 'btn-neutral text-neutral-content shadow-xs' : 'btn-ghost'"
          @click="setFilter(tab.id)"
        >
          <span>{{ tab.label }}</span>
          <span class="badge badge-xs font-mono font-bold whitespace-nowrap shrink-0">
            {{ tab.count }}
          </span>
        </button>
      </div>
    </div>

    <!-- LOADING SKELETONS -->
    <div v-if="loading" class="space-y-3">
      <div class="skeleton h-36 w-full rounded-2xl"></div>
      <div class="skeleton h-36 w-full rounded-2xl"></div>
    </div>

    <div v-else-if="loadError" class="alert alert-error rounded-2xl text-xs sm:text-sm flex items-center justify-between gap-3">
      <span>{{ loadError }}</span>
      <button type="button" class="btn btn-sm h-11 md:h-9 btn-outline rounded-xl font-bold" @click="loadTracker">
        Retry
      </button>
    </div>

    <div
      v-else-if="filteredCampaigns.length === 0"
      class="card bg-base-100 border border-dashed border-base-300 rounded-2xl p-8 text-center space-y-3"
    >
      <div class="text-base font-black text-base-content">No social promos in this view yet</div>
      <p class="text-xs text-base-content/65 max-w-md mx-auto">
        Tap <strong>+ New Promo / Drop</strong> (or pick an upcoming event above) to track cross-posts across Instagram, TikTok, Facebook, Whatnot, Depop, and eBay.
      </p>
      <div class="pt-1">
        <button
          type="button"
          class="btn btn-sm h-11 md:h-9 btn-primary text-primary-content rounded-xl font-black gap-1.5 px-4"
          @click="openNewCampaignDrawer"
        >
          <Icon icon="solar:add-circle-bold" class="w-4 h-4 shrink-0" />
          <span>+ New Promo / Drop</span>
        </button>
      </div>
    </div>

    <!-- CAMPAIGN CROSS-POST MATRIX CARDS -->
    <section v-else class="space-y-4">
      <article
        v-for="camp in filteredCampaigns"
        :key="camp.id"
        class="card bg-base-100 border border-base-300 rounded-2xl shadow-sm p-4 sm:p-5 space-y-4"
      >
        <div class="flex flex-col md:flex-row md:items-start justify-between gap-3">
          <div class="space-y-1.5 min-w-0">
            <div class="flex items-center gap-2 flex-wrap">
              <span class="badge badge-sm badge-secondary text-secondary-content font-bold whitespace-nowrap shrink-0">
                {{ sourceKindLabel(camp.sourceKind) }}
              </span>
              <span
                class="badge badge-sm font-mono font-bold whitespace-nowrap shrink-0"
                :class="
                  progressOf(camp).isComplete
                    ? 'badge-success text-success-content'
                    : 'badge-warning text-warning-content'
                "
              >
                {{ progressOf(camp).postedCount }} / {{ progressOf(camp).totalTargets }} Posted
              </span>
              <span
                v-if="camp.laborLoggedEntryId"
                class="badge badge-sm badge-info text-info-content font-bold whitespace-nowrap shrink-0"
              >
                ✅ Hours Logged
              </span>
              <span
                v-for="sku in camp.linkedSkus.slice(0, 4)"
                :key="sku"
                class="badge badge-xs badge-outline font-mono font-bold whitespace-nowrap shrink-0"
              >
                {{ sku }}
              </span>
            </div>

            <h2 class="text-base sm:text-lg font-black text-base-content leading-snug break-words">
              {{ camp.title }}
            </h2>

            <div v-if="camp.destinationUrl" class="text-xs">
              <a
                :href="camp.destinationUrl"
                target="_blank"
                rel="noopener noreferrer"
                class="font-bold text-primary hover:underline break-all"
              >
                Shopper / Event Link: {{ camp.destinationUrl.replace(/^https:\/\//, '') }} ↗
              </a>
            </div>
          </div>

          <div class="flex flex-wrap items-center gap-2 shrink-0">
            <button
              v-if="camp.plainFactSheet"
              type="button"
              class="btn btn-xs h-11 md:h-8 px-3 btn-outline rounded-xl font-bold gap-1.5"
              @click="copyFactSheet(camp)"
            >
              <Icon icon="solar:copy-bold" class="w-3.5 h-3.5 shrink-0" />
              <span>Copy Fact Sheet</span>
            </button>

            <button
              v-if="!camp.laborLoggedEntryId"
              type="button"
              class="btn btn-xs h-11 md:h-8 px-3 rounded-xl font-black gap-1.5"
              :class="
                progressOf(camp).liveUrls.length > 0
                  ? 'btn-outline btn-secondary'
                  : 'btn-outline border-base-300 text-base-content/85'
              "
              @click="openLaborDrawer(camp)"
            >
              <Icon icon="solar:clock-circle-bold" class="w-3.5 h-3.5 shrink-0" />
              <span>⏱️ Log Promo Hours</span>
            </button>

            <button
              type="button"
              class="btn btn-xs h-11 md:h-8 px-3 btn-ghost border border-base-300 rounded-xl font-bold"
              @click="openEditCampaignDrawer(camp)"
            >
              Edit
            </button>

            <button
              type="button"
              class="btn btn-xs h-11 md:h-8 px-2.5 btn-ghost text-error hover:bg-error/10 rounded-xl font-bold"
              @click="handleDeleteCampaign(camp)"
            >
              Delete
            </button>
          </div>
        </div>

        <!-- CHANNEL CROSS-POST MATRIX PILLS -->
        <div class="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2 pt-1">
          <button
            v-for="ch in SOCIAL_CHANNELS"
            :key="`${camp.id}-${ch.id}`"
            type="button"
            class="p-2.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between gap-1.5 min-h-16"
            :class="channelTileClass(camp, ch.id)"
            @click="openPostLogDrawer(camp, ch.id)"
          >
            <div class="flex items-center justify-between gap-1">
              <span class="text-xs font-black truncate">{{ ch.shortLabel }}</span>
              <span class="text-xs shrink-0">
                {{
                  camp.posts[ch.id]?.status === 'posted'
                    ? '✅'
                    : camp.posts[ch.id]?.status === 'skipped'
                      ? '⏭️'
                      : camp.targetChannels.includes(ch.id)
                        ? '🟡'
                        : '➕'
                }}
              </span>
            </div>
            <div class="text-[10px] leading-tight truncate opacity-80">
              {{
                camp.posts[ch.id]?.status === 'posted'
                  ? camp.posts[ch.id]?.metricsNote || (camp.posts[ch.id]?.postUrl ? 'Link saved ↗' : 'Marked posted')
                  : camp.posts[ch.id]?.status === 'skipped'
                    ? 'Skipped'
                    : camp.targetChannels.includes(ch.id)
                      ? 'Needs post'
                      : 'Optional'
              }}
            </div>
          </button>
        </div>
      </article>
    </section>

    <!-- DRAWER 1: CREATE / EDIT CAMPAIGN & PLAIN FACT SHEET -->
    <SlideOverDrawer
      v-model="campaignDrawerOpen"
      :title="isEditingExisting ? 'Edit Promo Row' : 'Track New Promo / Cross-Post'"
      subtitle="Choose target channels and keep a clean plain-text fact sheet handy for filming."
    >
      <div class="space-y-4">
        <div class="form-control gap-1">
          <label class="text-xs font-bold text-base-content/80">What Are We Promoting?</label>
          <select
            v-model="campaignForm.sourceKind"
            class="select select-bordered select-sm h-10 w-full rounded-xl bg-base-100 text-xs font-bold"
          >
            <option value="online_drop">🌐 Online Drop / Shared Storefront Listing</option>
            <option value="event">🎪 Upcoming Pop-Up, Market or Live Stream</option>
            <option value="booth_restock">🏪 Retail Booth Restock</option>
            <option value="general">📣 Collective Story / Haul / Community Post</option>
          </select>
        </div>

        <div class="form-control gap-1">
          <label class="text-xs font-bold text-base-content/80">Campaign / Post Title</label>
          <input
            v-model="campaignForm.title"
            type="text"
            maxlength="100"
            placeholder="e.g. Friday Whatnot Sci-Fi & TTRPG Boxed Set Drop"
            class="input input-bordered input-sm h-10 w-full rounded-xl bg-base-100 font-bold text-sm"
          />
        </div>

        <div class="form-control gap-1.5">
          <label class="text-xs font-bold text-base-content/80">Target Channels to Cross-Post</label>
          <div class="flex flex-wrap gap-1.5">
            <button
              v-for="ch in SOCIAL_CHANNELS.slice(0, 6)"
              :key="`form-ch-${ch.id}`"
              type="button"
              class="btn btn-sm h-11 md:h-9 px-3 rounded-xl font-bold"
              :class="
                campaignForm.targetChannels.includes(ch.id)
                  ? 'btn-primary text-primary-content'
                  : 'btn-ghost bg-base-200/60 border border-base-300'
              "
              @click="toggleTargetChannel(ch.id)"
            >
              {{ ch.label }}
            </button>
          </div>
          <details v-if="SOCIAL_CHANNELS.length > 6" class="pt-1">
            <summary class="text-xs font-bold text-primary cursor-pointer select-none">
              +{{ SOCIAL_CHANNELS.length - 6 }} more resale marketplaces
            </summary>
            <div class="flex flex-wrap gap-1.5 mt-2">
              <button
                v-for="ch in SOCIAL_CHANNELS.slice(6)"
                :key="`form-ch-more-${ch.id}`"
                type="button"
                class="btn btn-sm h-11 md:h-9 px-3 rounded-xl font-bold"
                :class="
                  campaignForm.targetChannels.includes(ch.id)
                    ? 'btn-primary text-primary-content'
                    : 'btn-ghost bg-base-200/60 border border-base-300'
                "
                @click="toggleTargetChannel(ch.id)"
              >
                {{ ch.label }}
              </button>
            </div>
          </details>
        </div>

        <div class="form-control gap-1">
          <label class="text-xs font-bold text-base-content/80">Linked Item Barcodes / SKUs (Comma-Separated, Optional)</label>
          <input
            v-model="linkedSkusInput"
            type="text"
            placeholder="HUCK-1402, PDXGL-0118"
            class="input input-bordered input-sm h-10 w-full rounded-xl bg-base-100 font-mono text-xs"
          />
        </div>

        <div class="form-control gap-1">
          <label class="text-xs font-bold text-base-content/80">Shopper / RSVP Destination Link (https:// only)</label>
          <input
            v-model="campaignForm.destinationUrl"
            type="url"
            placeholder="https://whatnot.com/invite/huckfinds"
            class="input input-bordered input-sm h-10 w-full rounded-xl bg-base-100 font-mono text-xs"
          />
          <span v-if="destinationUrlWarning" class="text-[11px] text-error font-semibold">
            {{ destinationUrlWarning }}
          </span>
        </div>

        <div class="form-control gap-1">
          <div class="flex items-center justify-between">
            <label class="text-xs font-bold text-base-content/80">Plain Fact Sheet (Title, Price, SKU, Link)</label>
            <button
              type="button"
              class="text-[11px] font-bold text-primary hover:underline"
              @click="regenerateFormFactSheet"
            >
              Auto-Fill Facts
            </button>
          </div>
          <textarea
            v-model="campaignForm.plainFactSheet"
            rows="5"
            maxlength="1800"
            placeholder="Clean bullet facts to copy into IG/TikTok/Whatnot descriptions..."
            class="textarea textarea-bordered w-full rounded-xl bg-base-100 text-xs font-mono leading-relaxed"
          ></textarea>
        </div>
      </div>

      <template #footer>
        <div class="flex items-center justify-end gap-2">
          <button type="button" class="btn btn-sm h-11 md:h-9 btn-ghost rounded-xl font-bold" @click="campaignDrawerOpen = false">
            Cancel
          </button>
          <button
            type="button"
            :disabled="saving || !campaignForm.title.trim() || Boolean(destinationUrlWarning)"
            class="btn btn-sm h-11 md:h-9 btn-primary text-primary-content rounded-xl font-black px-4 shadow-sm"
            @click="saveCampaignFromDrawer"
          >
            {{ saving ? 'Saving…' : isEditingExisting ? 'Save Changes' : 'Create Tracker Row' }}
          </button>
        </div>
      </template>
    </SlideOverDrawer>

    <!-- DRAWER 2: LOG SINGLE CHANNEL POST LINK & METRICS -->
    <SlideOverDrawer
      v-model="postLogDrawerOpen"
      :title="`Log ${activeChannelMeta?.label || 'Social'} Post`"
      :subtitle="activePostCampaign?.title || ''"
    >
      <div v-if="activePostCampaign && activeChannelMeta" class="space-y-4">
        <div class="grid grid-cols-3 gap-2">
          <button
            v-for="st in (['posted', 'pending', 'skipped'] as const)"
            :key="st"
            type="button"
            class="btn btn-sm h-11 rounded-xl font-bold capitalize"
            :class="
              postLogForm.status === st
                ? st === 'posted'
                  ? 'btn-success text-success-content'
                  : 'btn-neutral text-neutral-content'
                : 'btn-ghost bg-base-200/60 border border-base-300'
            "
            @click="postLogForm.status = st"
          >
            {{ st === 'posted' ? '✅ Posted' : st === 'skipped' ? '⏭️ Skip' : '🟡 Pending' }}
          </button>
        </div>

        <div class="form-control gap-1">
          <label class="text-xs font-bold text-base-content/80">Live Post URL (https:// — proof for Sweat-Equity hours)</label>
          <input
            v-model="postLogForm.postUrl"
            type="url"
            placeholder="https://www.instagram.com/reel/..."
            class="input input-bordered input-sm h-10 w-full rounded-xl bg-base-100 font-mono text-xs"
          />
          <span v-if="postLogUrlWarning" class="text-[11px] text-error font-semibold">
            {{ postLogUrlWarning }}
          </span>
        </div>

        <div class="form-control gap-1">
          <label class="text-xs font-bold text-base-content/80">Date Posted</label>
          <input
            v-model="postLogForm.postedAt"
            type="date"
            class="input input-bordered input-sm h-10 w-full rounded-xl bg-base-100 font-mono text-xs"
          />
        </div>

        <div class="form-control gap-1">
          <label class="text-xs font-bold text-base-content/80">Quick Result / Views Note (Optional)</label>
          <input
            v-model="postLogForm.metricsNote"
            type="text"
            maxlength="120"
            placeholder="e.g. 1,400 views • 3 DMs • Sold velvet jacket"
            class="input input-bordered input-sm h-10 w-full rounded-xl bg-base-100 text-xs"
          />
        </div>

        <div class="pt-1">
          <a
            :href="activeChannelMeta.profileUrl"
            target="_blank"
            rel="noopener noreferrer"
            class="text-xs font-bold text-primary hover:underline"
          >
            Open Collective {{ activeChannelMeta.label }} Profile ↗
          </a>
        </div>
      </div>

      <template #footer>
        <div class="flex items-center justify-end gap-2">
          <button type="button" class="btn btn-sm h-11 md:h-9 btn-ghost rounded-xl font-bold" @click="postLogDrawerOpen = false">
            Cancel
          </button>
          <button
            type="button"
            :disabled="saving || Boolean(postLogUrlWarning)"
            class="btn btn-sm h-11 md:h-9 btn-primary text-primary-content rounded-xl font-black px-4 shadow-sm"
            @click="savePostLogFromDrawer"
          >
            {{ saving ? 'Saving…' : 'Save Channel Status' }}
          </button>
        </div>
      </template>
    </SlideOverDrawer>

    <!-- DRAWER 3: 1-CLICK LOG VERIFIED PROMOTER SWEAT-EQUITY HOURS -->
    <SlideOverDrawer
      v-model="laborDrawerOpen"
      title="Log Verified Promo Hours"
      subtitle="Sends your live post links directly into the Official Labor Ledger for Founder approval."
    >
      <div v-if="laborTargetCampaign" class="space-y-4">
        <div class="rounded-2xl bg-base-200/60 border border-base-300 p-3.5 space-y-1.5 text-xs">
          <div class="font-black text-sm text-base-content">{{ laborTargetCampaign.title }}</div>
          <div
            v-if="progressOf(laborTargetCampaign).liveUrls.length > 0"
            class="text-base-content/70 font-mono break-all"
          >
            Proof link(s): {{ progressOf(laborTargetCampaign).liveUrls.join(' | ') }}
          </div>
          <div v-else class="space-y-2 pt-0.5">
            <div class="text-warning font-bold">
              Step 1 needed: Save at least 1 live https:// post link on a channel tile first so Founder approval includes proof.
            </div>
            <button
              type="button"
              class="btn btn-xs h-10 px-3 btn-primary text-primary-content rounded-xl font-black gap-1.5"
              @click="
                laborDrawerOpen = false;
                openPostLogDrawer(laborTargetCampaign, laborTargetCampaign.targetChannels[0] || 'instagram');
              "
            >
              <span>Paste First Post Link</span>
              <span>➔</span>
            </button>
          </div>
        </div>

        <div class="rounded-xl bg-warning/10 border border-warning/30 p-3 text-xs text-base-content/85">
          <strong>No Double-Dipping Reminder:</strong> Log hours here for shared Collective promotion, events, and multi-curator drops. Own-item or co-curated item prep is compensated through your Gate 3 Curator share.
        </div>

        <div class="form-control gap-1">
          <label class="text-xs font-bold text-base-content/80">Hours Spent Filming, Editing &amp; Cross-Posting</label>
          <input
            v-model="laborHoursInput"
            type="text"
            inputmode="decimal"
            placeholder="1.0"
            class="input input-bordered input-sm h-10 w-full rounded-xl bg-base-100 font-mono font-bold text-sm"
          />
        </div>

        <div class="form-control gap-1">
          <label class="text-xs font-bold text-base-content/80">Work Summary</label>
          <input
            v-model="laborNotesInput"
            type="text"
            maxlength="180"
            class="input input-bordered input-sm h-10 w-full rounded-xl bg-base-100 text-xs"
          />
        </div>
      </div>

      <template #footer>
        <div class="flex items-center justify-end gap-2">
          <button type="button" class="btn btn-sm h-11 md:h-9 btn-ghost rounded-xl font-bold" @click="laborDrawerOpen = false">
            Cancel
          </button>
          <button
            type="button"
            :disabled="loggingLabor || !laborTargetCampaign || progressOf(laborTargetCampaign).liveUrls.length === 0"
            class="btn btn-sm h-11 md:h-9 btn-success text-success-content rounded-xl font-black px-4 shadow-sm"
            @click="submitVerifiedPromoLabor"
          >
            {{ loggingLabor ? 'Saving hours…' : 'Save Hours to Official Ledger' }}
          </button>
        </div>
      </template>
    </SlideOverDrawer>

    <!-- STICKY BOTTOM ACTION DOCK -->
    <BottomActionDock>
      <template #left>
        <div class="flex items-center gap-2 text-xs min-w-0">
          <Icon icon="solar:share-circle-bold-duotone" class="w-4 h-4 text-primary shrink-0" />
          <span class="font-bold truncate">
            {{ needsCrossPostCount }} campaign{{ needsCrossPostCount === 1 ? '' : 's' }} waiting on cross-posts • {{ totalLivePostsCount }} live links saved
          </span>
        </div>
      </template>
      <template #right>
        <div class="sm:mr-16 flex items-center">
          <button
            type="button"
            class="btn btn-sm sm:btn-md h-11 btn-primary text-primary-content rounded-2xl font-black gap-1.5 px-5 shadow-md"
            @click="openNewCampaignDrawer"
          >
            <Icon icon="solar:add-circle-bold" class="w-4 h-4 shrink-0" />
            <span>+ New Promo / Drop</span>
          </button>
        </div>
      </template>
    </BottomActionDock>
  </div>
  </CollectiveAccessGate>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { Icon } from '@iconify/vue';
import CollectiveAccessGate from '../common/CollectiveAccessGate.vue';
import BottomActionDock from '../common/BottomActionDock.vue';
import KpiStatGrid, { type KpiStatItem } from '../common/KpiStatGrid.vue';
import SlideOverDrawer from '../common/SlideOverDrawer.vue';
import { useAuth } from '../../composables/useAuth';
import { useUrlTab } from '../../composables/useUrlTab';
import { useMemberCapabilities } from '../../lib/memberAccess';
import { logSweatEquityLaborEntry, pacificTodayYmd } from '../../lib/coopGovernance';
import { getCoopJwtHeaders } from '../../lib/coopLedgerClient';
import { normalizePublicEvent, sanitizeHttpsUrl, type CoopPublicEvent } from '../../lib/flagshipContent';
import { parsePriceValue } from '../../lib/lot-strategy';
import {
  DEFAULT_TARGET_SOCIAL_CHANNELS,
  SOCIAL_CHANNELS,
  buildPlainFactSheet,
  createEmptyPostsMap,
  normalizeSocialCampaign,
  summarizeCampaignProgress,
  type SocialChannelId,
  type SocialPlatformPostLog,
  type SocialPromoCampaign,
  type SocialSourceKind,
} from '../../lib/socialTracker';
import { toUserMessage } from '../../lib/userFacingErrors';
import { confirmDialog } from '../../stores/confirm';
import { addToast } from '../../stores/toast';

const { user } = useAuth();
const { capabilities } = useMemberCapabilities();

const loading = ref(true);
const saving = ref(false);
const loadError = ref('');
const trackerVersion = ref(1);
const campaigns = ref<SocialPromoCampaign[]>([]);
const scheduledEvents = ref<CoopPublicEvent[]>([]);
const {
  activeTab: activeFilter,
  setTab: setFilter,
  tabSectionRef,
} = useUrlTab<'all' | 'needs_post' | 'complete' | 'events'>({
  tabs: ['all', 'needs_post', 'complete', 'events'],
  defaultTab: 'all',
  legacyQueryParams: ['tab'],
});

// Drawer 1: Campaign create/edit
const campaignDrawerOpen = ref(false);
const isEditingExisting = ref(false);
const linkedSkusInput = ref('');
const campaignForm = ref<SocialPromoCampaign>(
  normalizeSocialCampaign({
    id: '',
    title: '',
    sourceKind: 'online_drop',
    targetChannels: [...DEFAULT_TARGET_SOCIAL_CHANNELS],
    posts: createEmptyPostsMap(),
    destinationUrl: '',
    plainFactSheet: '',
  })
);

// Drawer 2: Single channel post link logger
const postLogDrawerOpen = ref(false);
const activePostCampaign = ref<SocialPromoCampaign | null>(null);
const activePostChannelId = ref<SocialChannelId>('instagram');
const postLogForm = ref<SocialPlatformPostLog>({
  channel: 'instagram',
  status: 'posted',
  postUrl: '',
  postedAt: pacificTodayYmd(),
  postedBy: '',
  metricsNote: '',
});

// Drawer 3: Verified Sweat-Equity Labor Logger
const laborDrawerOpen = ref(false);
const loggingLabor = ref(false);
const laborTargetCampaign = ref<SocialPromoCampaign | null>(null);
const laborHoursInput = ref('1.0');
const laborNotesInput = ref('');

const progressOf = (camp: SocialPromoCampaign) => summarizeCampaignProgress(camp);

const needsCrossPostCount = computed(
  () => campaigns.value.filter((c) => !c.archived && progressOf(c).pendingCount > 0).length
);

const completedCampaignsCount = computed(
  () => campaigns.value.filter((c) => !c.archived && progressOf(c).isComplete).length
);

const eventCampaignsCount = computed(
  () => campaigns.value.filter((c) => !c.archived && c.sourceKind === 'event').length
);

const totalLivePostsCount = computed(() =>
  campaigns.value.reduce((sum, c) => sum + progressOf(c).liveUrls.length, 0)
);

const readyForLaborCount = computed(
  () =>
    campaigns.value.filter(
      (c) => !c.archived && !c.laborLoggedEntryId && progressOf(c).liveUrls.length > 0
    ).length
);

const kpiStats = computed<KpiStatItem[]>(() => [
  {
    label: 'Needs Cross-Post',
    value: String(needsCrossPostCount.value),
    hint: 'Campaigns with open target channels',
    badge: needsCrossPostCount.value > 0 ? 'Action' : 'Clear',
    badgeClass:
      needsCrossPostCount.value > 0
        ? 'badge-warning text-warning-content'
        : 'badge-success text-success-content',
  },
  {
    label: 'Live Post Links',
    value: String(totalLivePostsCount.value),
    hint: 'Saved across IG, TikTok, Whatnot & more',
    icon: 'solar:link-circle-bold-duotone',
    tone: 'text-primary',
  },
  {
    label: 'Event & Pop-Up Promos',
    value: String(eventCampaignsCount.value),
    hint: `${untrackedEvents.value.length} scheduled event(s) ready to seed`,
    icon: 'solar:calendar-mark-bold-duotone',
    tone: 'text-secondary',
  },
  {
    label: 'Ready for Hours Log',
    value: String(readyForLaborCount.value),
    hint: 'Verified links ready for Labor Pool',
    badge: '🔒 Official Ledger',
    badgeClass: 'badge-info text-info-content',
  },
]);

const filterTabs = computed(() => [
  { id: 'all' as const, label: 'All Active', count: campaigns.value.filter((c) => !c.archived).length },
  { id: 'needs_post' as const, label: '🟡 Needs Cross-Post', count: needsCrossPostCount.value },
  { id: 'complete' as const, label: '✅ All Posted', count: completedCampaignsCount.value },
  { id: 'events' as const, label: '🎪 Events', count: eventCampaignsCount.value },
]);

const filteredCampaigns = computed(() => {
  const base = campaigns.value.filter((c) => !c.archived);
  if (activeFilter.value === 'needs_post') {
    return base.filter((c) => progressOf(c).pendingCount > 0);
  }
  if (activeFilter.value === 'complete') {
    return base.filter((c) => progressOf(c).isComplete);
  }
  if (activeFilter.value === 'events') {
    return base.filter((c) => c.sourceKind === 'event');
  }
  return base;
});

const untrackedEvents = computed(() => {
  const trackedIds = new Set(campaigns.value.map((c) => c.linkedEventId).filter(Boolean));
  return scheduledEvents.value.filter(
    (ev) => (ev.status === 'live' || ev.status === 'upcoming') && !trackedIds.has(ev.id)
  );
});

const activeChannelMeta = computed(() =>
  SOCIAL_CHANNELS.find((c) => c.id === activePostChannelId.value)
);

const destinationUrlWarning = computed(() => {
  const raw = campaignForm.value.destinationUrl.trim();
  if (!raw) return '';
  return sanitizeHttpsUrl(raw) ? '' : 'Links must begin with https://';
});

const postLogUrlWarning = computed(() => {
  const raw = postLogForm.value.postUrl.trim();
  if (!raw) return '';
  return sanitizeHttpsUrl(raw) ? '' : 'Post URLs must begin with https://';
});

const sourceKindLabel = (k: SocialSourceKind): string => {
  if (k === 'event') return '🎪 Event / Pop-Up';
  if (k === 'online_drop') return '🌐 Online Drop';
  if (k === 'booth_restock') return '🏪 Booth Restock';
  return '📣 Collective Post';
};

const channelTileClass = (camp: SocialPromoCampaign, chId: SocialChannelId): string => {
  const st = camp.posts[chId]?.status || 'pending';
  if (st === 'posted') {
    return 'border-success/60 bg-success/10 text-base-content';
  }
  if (st === 'skipped') {
    return 'border-base-300 bg-base-200/40 text-base-content/50';
  }
  if (camp.targetChannels.includes(chId)) {
    return 'border-warning/50 bg-warning/5 hover:border-warning text-base-content';
  }
  return 'border-base-300 bg-base-100 hover:border-base-content/30 text-base-content/70';
};

const loadTracker = async () => {
  loading.value = true;
  loadError.value = '';
  try {
    const headers = await getCoopJwtHeaders();
    const [trackerRes, cmsRes] = await Promise.all([
      fetch('/api/coop/social-tracker', { method: 'GET', headers }),
      fetch('/api/public/flagship-content').catch(() => null),
    ]);

    const body = await trackerRes.json().catch(() => null);
    if (!trackerRes.ok) {
      throw new Error(body?.error || `Status ${trackerRes.status}`);
    }
    trackerVersion.value = Number(body?.version || 1);
    campaigns.value = Array.isArray(body?.campaigns)
      ? body.campaigns.map((c: any, idx: number) => normalizeSocialCampaign(c, idx))
      : [];

    if (cmsRes && cmsRes.ok) {
      const cmsBody = await cmsRes.json().catch(() => null);
      if (Array.isArray(cmsBody?.events)) {
        scheduledEvents.value = cmsBody.events.map((ev: any, idx: number) =>
          normalizePublicEvent(ev, idx)
        );
      }
    }
  } catch (err: any) {
    console.warn('[SocialCrossPostView] Load failed:', err);
    loadError.value = toUserMessage(err, "Couldn't load the Social Tracker — tap Retry.");
  } finally {
    loading.value = false;
  }
};

const persistCampaignMutation = async (
  action: 'upsert_campaign' | 'delete_campaign',
  payload: { campaign?: SocialPromoCampaign; id?: string }
): Promise<boolean> => {
  saving.value = true;
  try {
    const headers = await getCoopJwtHeaders();
    const res = await fetch('/api/coop/social-tracker', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        action,
        expectedVersion: trackerVersion.value,
        ...payload,
      }),
    });
    const body = await res.json().catch(() => null);
    if (!res.ok) {
      if (res.status === 409) {
        await loadTracker();
      }
      throw new Error(body?.error || `Status ${res.status}`);
    }
    trackerVersion.value = Number(body?.version || trackerVersion.value + 1);
    campaigns.value = Array.isArray(body?.campaigns)
      ? body.campaigns.map((c: any, idx: number) => normalizeSocialCampaign(c, idx))
      : campaigns.value;
    return true;
  } catch (err: any) {
    console.warn('[SocialCrossPostView] Mutation failed:', err);
    addToast(toUserMessage(err, "Couldn't save your update — please try again."), 'error');
    return false;
  } finally {
    saving.value = false;
  }
};

const openNewCampaignDrawer = () => {
  postLogDrawerOpen.value = false;
  laborDrawerOpen.value = false;
  isEditingExisting.value = false;
  linkedSkusInput.value = '';
  campaignForm.value = normalizeSocialCampaign({
    id: `promo-${Date.now().toString(36)}`,
    title: '',
    sourceKind: 'online_drop',
    targetChannels: [...DEFAULT_TARGET_SOCIAL_CHANNELS],
    posts: createEmptyPostsMap(),
    destinationUrl: '',
    plainFactSheet: '',
  });
  campaignForm.value.title = '';
  campaignDrawerOpen.value = true;
};

const openEditCampaignDrawer = (camp: SocialPromoCampaign) => {
  postLogDrawerOpen.value = false;
  laborDrawerOpen.value = false;
  isEditingExisting.value = true;
  campaignForm.value = JSON.parse(JSON.stringify(camp));
  linkedSkusInput.value = camp.linkedSkus.join(', ');
  campaignDrawerOpen.value = true;
};

const toggleTargetChannel = (chId: SocialChannelId) => {
  const cur = new Set(campaignForm.value.targetChannels);
  if (cur.has(chId)) {
    if (cur.size > 1) cur.delete(chId);
  } else {
    cur.add(chId);
  }
  campaignForm.value.targetChannels = Array.from(cur);
};

const parseSkusList = (raw: string): string[] =>
  Array.from(
    new Set(
      raw
        .split(/[\s,]+/)
        .map((s) => s.trim().toUpperCase())
        .filter(Boolean)
    )
  ).slice(0, 20);

const regenerateFormFactSheet = () => {
  const skus = parseSkusList(linkedSkusInput.value);
  campaignForm.value.plainFactSheet = buildPlainFactSheet({
    title: campaignForm.value.title || 'Collective Featured Drop',
    items: skus.map((sku) => ({ title: `Featured Piece`, upc: sku })),
    destinationUrl: campaignForm.value.destinationUrl,
  });
};

const saveCampaignFromDrawer = async () => {
  const next = normalizeSocialCampaign({
    ...campaignForm.value,
    linkedSkus: parseSkusList(linkedSkusInput.value),
  });
  if (!next.plainFactSheet.trim()) {
    next.plainFactSheet = buildPlainFactSheet({
      title: next.title,
      destinationUrl: next.destinationUrl,
    });
  }
  const ok = await persistCampaignMutation('upsert_campaign', { campaign: next });
  if (ok) {
    campaignDrawerOpen.value = false;
    addToast('✅ Saved to Social Tracker', 'success');
  }
};

const seedFromEvent = async (ev: CoopPublicEvent) => {
  const targets: SocialChannelId[] =
    ev.eventKind === 'online_live'
      ? ['instagram', 'tiktok', 'whatnot', 'district']
      : ['instagram', 'tiktok', 'facebook'];
  const seeded = normalizeSocialCampaign({
    id: `promo-ev-${ev.id.slice(0, 24)}-${Date.now().toString(36).slice(-4)}`,
    title: ev.title,
    sourceKind: 'event',
    linkedEventId: ev.id,
    targetChannels: targets,
    posts: createEmptyPostsMap(),
    destinationUrl: ev.ctaUrl || 'https://thehc.llc/#works',
    plainFactSheet: buildPlainFactSheet({
      title: ev.title,
      event: ev,
      destinationUrl: ev.ctaUrl || 'https://thehc.llc/#works',
    }),
  });
  const ok = await persistCampaignMutation('upsert_campaign', { campaign: seeded });
  if (ok) {
    addToast(`🎪 Added "${ev.title}" to Cross-Post Tracker`, 'success');
  }
};

const openPostLogDrawer = (camp: SocialPromoCampaign, chId: SocialChannelId) => {
  campaignDrawerOpen.value = false;
  laborDrawerOpen.value = false;
  activePostCampaign.value = camp;
  activePostChannelId.value = chId;
  const existing = camp.posts[chId] || {
    channel: chId,
    status: 'pending',
    postUrl: '',
    postedAt: '',
    postedBy: '',
    metricsNote: '',
  };
  postLogForm.value = {
    channel: chId,
    status: existing.status === 'pending' ? 'posted' : existing.status,
    postUrl: existing.postUrl || '',
    postedAt: existing.postedAt || pacificTodayYmd(),
    postedBy: existing.postedBy || String(user.value?.name || ''),
    metricsNote: existing.metricsNote || '',
  };
  postLogDrawerOpen.value = true;
};

const savePostLogFromDrawer = async () => {
  if (!activePostCampaign.value) return;
  const clone: SocialPromoCampaign = JSON.parse(JSON.stringify(activePostCampaign.value));
  clone.posts[activePostChannelId.value] = {
    channel: activePostChannelId.value,
    status: postLogForm.value.status,
    postUrl: sanitizeHttpsUrl(postLogForm.value.postUrl),
    postedAt: postLogForm.value.postedAt || pacificTodayYmd(),
    postedBy: postLogForm.value.postedBy,
    metricsNote: postLogForm.value.metricsNote.trim(),
  };
  const ok = await persistCampaignMutation('upsert_campaign', { campaign: clone });
  if (ok) {
    postLogDrawerOpen.value = false;
    addToast(`✅ Updated ${activeChannelMeta.value?.label || 'channel'} status`, 'success');
  }
};

const copyFactSheet = async (camp: SocialPromoCampaign) => {
  try {
    await navigator.clipboard.writeText(camp.plainFactSheet);
    addToast('📋 Copied Plain Fact Sheet to clipboard', 'success');
  } catch {
    addToast("Couldn't copy automatically — open Edit to select text.", 'info');
  }
};

const openLaborDrawer = (camp: SocialPromoCampaign) => {
  campaignDrawerOpen.value = false;
  postLogDrawerOpen.value = false;
  laborTargetCampaign.value = camp;
  laborHoursInput.value = '1.0';
  const count = progressOf(camp).liveUrls.length;
  laborNotesInput.value = `Cross-posted "${camp.title}" (${count} verified link${count === 1 ? '' : 's'})`;
  laborDrawerOpen.value = true;
};

const submitVerifiedPromoLabor = async () => {
  const camp = laborTargetCampaign.value;
  if (!camp || loggingLabor.value) return;
  const urls = progressOf(camp).liveUrls;
  if (urls.length === 0) return;

  const hours = Math.min(12, Math.max(0.25, parsePriceValue(laborHoursInput.value, 'first', 1)));
  loggingLabor.value = true;
  try {
    const res = await logSweatEquityLaborEntry({
      member: user.value?.name || undefined,
      category: 'Social & Marketing',
      hours,
      deliverableRef: urls.slice(0, 4).join(' | '),
      notes: laborNotesInput.value.trim() || `Cross-post campaign: ${camp.title}`,
      date: pacificTodayYmd(),
    });
    if (!res.syncedToCloud) {
      throw new Error(res.error || "Couldn't save labor hours.");
    }
    const clone: SocialPromoCampaign = JSON.parse(JSON.stringify(camp));
    clone.laborLoggedEntryId = res.entry.id;
    await persistCampaignMutation('upsert_campaign', { campaign: clone });
    laborDrawerOpen.value = false;
    addToast(`✅ Logged ${hours}h to Official Labor Ledger (Pending Founder approval)`, 'success');
  } catch (err: any) {
    console.warn('[SocialCrossPostView] Labor log failed:', err);
    addToast(toUserMessage(err, "Couldn't save hours right now — please try again."), 'error');
  } finally {
    loggingLabor.value = false;
  }
};

const handleDeleteCampaign = async (camp: SocialPromoCampaign) => {
  const ok = await confirmDialog(
    `Remove "${camp.title}" from the Social Cross-Post Tracker?`,
    'Remove Promo Row',
    'Remove',
    'Cancel',
    'btn-error'
  );
  if (!ok) return;
  const saved = await persistCampaignMutation('delete_campaign', { id: camp.id });
  if (saved) {
    addToast('Removed from Social Tracker', 'info');
  }
};

onMounted(() => {
  if (!capabilities.value.canSeeCollectiveFinancials) return;
  const params = new URLSearchParams(window.location.search);
  const seedTitle = params.get('seedTitle');
  const seedSku = params.get('seedSku');
  const seedUrl = sanitizeHttpsUrl(params.get('seedUrl') || '');
  loadTracker().then(() => {
    if (seedTitle) {
      isEditingExisting.value = false;
      linkedSkusInput.value = seedSku || '';
      campaignForm.value = normalizeSocialCampaign({
        id: `promo-${Date.now().toString(36)}`,
        title: seedTitle,
        sourceKind: 'online_drop',
        linkedSkus: seedSku ? [seedSku] : [],
        targetChannels: [...DEFAULT_TARGET_SOCIAL_CHANNELS],
        posts: createEmptyPostsMap(),
        destinationUrl: seedUrl,
        plainFactSheet: buildPlainFactSheet({
          title: seedTitle,
          destinationUrl: seedUrl,
          items: seedSku ? [{ title: seedTitle, upc: seedSku }] : [],
        }),
      });
      campaignDrawerOpen.value = true;
    }
  });
});
</script>

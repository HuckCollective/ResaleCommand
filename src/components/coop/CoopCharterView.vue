<template>
  <div class="rc-page-shell space-y-6 pb-10">
    <!-- Guest Onboarding Banner -->
    <div
      v-if="!showMemberActions"
      class="rounded-2xl border border-primary/30 bg-primary/5 px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 print:hidden"
    >
      <div class="text-sm">
        <span class="font-black">👋 Exploring The Huckleberry Collective?</span>
        <span class="text-base-content/75">
          Tell us how you'd like to be part of it, or sign in if you're already a member.
        </span>
      </div>
      <div class="flex flex-wrap items-center gap-2 shrink-0">
        <button
          type="button"
          class="btn btn-sm btn-primary text-primary-content rounded-xl font-black gap-1.5"
          @click="showConnectModal = true"
        >
          <Icon icon="solar:hand-shake-bold" class="w-4 h-4 shrink-0" />
          <span>Connect With Us</span>
        </button>
        <a href="/login" class="btn btn-sm btn-outline rounded-xl font-bold">Member Login</a>
        <a href="/demo" class="btn btn-sm btn-ghost border border-base-300 rounded-xl font-bold">Example Dashboard</a>
      </div>
    </div>

    <!-- Hero Banner with WSDE Framing & 3 Core Guarantees -->
    <div class="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary/15 via-base-200 to-base-100 border border-primary/25 p-6 sm:p-10 shadow-xl">
      <div class="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 relative z-10">
        <div class="space-y-3 max-w-2xl">
          <div class="flex items-center gap-2 flex-wrap">
            <span class="badge badge-primary font-bold gap-1 text-xs px-3 py-1 shadow-sm">
              <Icon icon="solar:shield-star-bold" class="w-3.5 h-3.5 shrink-0" />
              <span>Worker Self-Directed Enterprise (WSDE)</span>
            </span>
            <span class="badge badge-outline text-xs font-semibold">Democracy at Work</span>
            <span class="badge badge-neutral text-xs font-mono font-bold">1 Member = 1 Vote</span>
          </div>

          <h1 class="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight text-base-content">
            The Huckleberry Collective
          </h1>
          <p class="text-sm sm:text-base text-base-content/85 leading-relaxed font-medium">
            Worker Cooperative &amp; Multi-Channel Resale Consortium. Equal partners, 100% open-book transparency, and shared prosperity without middleman cuts.
          </p>
        </div>

        <div class="flex flex-wrap items-center gap-2.5 shrink-0 print:hidden">
          <a
            v-if="showMemberActions"
            href="/expenses"
            class="btn btn-sm btn-secondary text-secondary-content gap-2 shadow-sm font-bold rounded-xl"
            title="Upload invoice PDFs and view Commons Expense Ledger"
          >
            <Icon icon="solar:document-bold" class="w-4 h-4 shrink-0" />
            <span>Expenses &amp; Receipts</span>
          </a>

          <button
            type="button"
            class="btn btn-sm btn-outline gap-2 shadow-sm font-bold bg-base-100/80 hover:bg-base-200 rounded-xl"
            title="Print or Save Charter as PDF"
            @click="handlePrint"
          >
            <Icon icon="solar:printer-bold" class="w-4 h-4 text-primary shrink-0" />
            <span>Print / PDF</span>
          </button>

          <button
            type="button"
            class="btn btn-sm btn-primary text-primary-content gap-2 shadow-sm font-bold rounded-xl"
            title="Copy link to send to prospective members or partner curators"
            @click="copyShareLink"
          >
            <Icon :icon="copiedLink ? 'solar:check-circle-bold' : 'solar:share-bold'" class="w-4 h-4 shrink-0" />
            <span>{{ copiedLink ? 'Copied Link!' : 'Share Charter' }}</span>
          </button>
        </div>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-3 gap-3.5 mt-8 pt-6 border-t border-base-content/10">
        <div class="bg-base-100/80 backdrop-blur-xs p-4 rounded-2xl border border-success/30 shadow-xs space-y-1">
          <div class="flex items-center gap-2">
            <span class="text-xl">🛡️</span>
            <span class="font-extrabold text-sm text-success">Guarantee 1</span>
          </div>
          <div class="text-base font-black text-base-content">100% Capital Returned First</div>
          <p class="text-xs text-base-content/75 leading-relaxed">
            Whatever you paid out of pocket to acquire inventory returns dollar-for-dollar first on every sold item.
          </p>
        </div>

        <div class="bg-base-100/80 backdrop-blur-xs p-4 rounded-2xl border border-primary/30 shadow-xs space-y-1">
          <div class="flex items-center gap-2">
            <span class="text-xl">💎</span>
            <span class="font-extrabold text-sm text-primary">Guarantee 2</span>
          </div>
          <div class="text-base font-black text-base-content">{{ curatorPct }}% Curator Profit Share</div>
          <p class="text-xs text-base-content/75 leading-relaxed">
            You spotted the piece and fronted the capital—you keep the vast majority of Net Surplus on every sale.
          </p>
        </div>

        <div class="bg-base-100/80 backdrop-blur-xs p-4 rounded-2xl border border-secondary/30 shadow-xs space-y-1">
          <div class="flex items-center gap-2">
            <span class="text-xl">🤝</span>
            <span class="font-extrabold text-sm text-secondary">Guarantee 3</span>
          </div>
          <div class="text-base font-black text-base-content">{{ commonsPct }}% Shared Commons Pool</div>
          <p class="text-xs text-base-content/75 leading-relaxed">
            Covers retail booth rent ({{ primaryBoothRentLabel }}/mo primary booth), thermal labels, software, and Sweat-Equity labor dividends.
          </p>
        </div>
      </div>
    </div>

    <!-- WAYS TO JOIN THE COLLECTIVE (Driven by src/content/roles/*.md) -->
    <section class="space-y-3">
      <div class="flex items-end justify-between flex-wrap gap-2">
        <div>
          <div class="text-xs font-extrabold uppercase tracking-wider text-primary">Find Your Hat</div>
          <h2 class="text-xl sm:text-2xl font-black tracking-tight">Ways to join the Collective</h2>
        </div>
        <button
          v-if="!showMemberActions"
          type="button"
          class="btn btn-sm btn-primary text-primary-content rounded-xl font-bold print:hidden"
          @click="showConnectModal = true"
        >
          Connect With Us
        </button>
        <a
          v-else
          href="/dashboard"
          class="btn btn-sm btn-primary text-primary-content rounded-xl font-bold gap-1.5 print:hidden"
        >
          <Icon icon="solar:rocket-2-bold" class="w-4 h-4 shrink-0" />
          <span>Open My Role Dashboard</span>
        </a>
      </div>

      <div class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
        <div
          v-for="hat in joinRoleCards"
          :key="hat.id"
          class="card bg-base-100 border border-base-300 shadow-sm rounded-2xl p-4 space-y-2.5 flex flex-col justify-between"
        >
          <div class="space-y-2">
            <div class="flex items-center gap-2">
              <span class="text-2xl">{{ hat.icon }}</span>
              <span class="font-black text-base">{{ hat.title }}</span>
            </div>
            <p class="text-xs text-base-content/75 leading-relaxed">{{ hat.pitch }}</p>
            <details v-if="hat.html" class="text-xs text-base-content/70 pt-0.5">
              <summary class="cursor-pointer font-bold text-primary select-none">How this role works</summary>
              <div class="prose prose-xs max-w-none pt-1.5 text-base-content/80" v-html="hat.html"></div>
            </details>
          </div>

          <div class="flex flex-wrap gap-1.5 pt-1">
            <span v-for="tag in hat.tags" :key="tag" class="badge badge-sm badge-ghost font-semibold">{{ tag }}</span>
          </div>
        </div>
      </div>
    </section>

    <!-- 5 PILLAR SUMMARY CARDS (Driven by src/content/charter/*.md) -->
    <div class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-3 print:hidden">
      <div
        v-for="section in sections"
        :key="section.id"
        class="card border-2 rounded-2xl p-4 space-y-2 cursor-pointer transition-all"
        :class="activeSection === section.id ? 'border-primary bg-primary/5 shadow-md' : 'border-base-300 bg-base-100 hover:border-base-content/30'"
        role="button"
        tabindex="0"
        @click="selectSection(section.id)"
        @keydown.enter="selectSection(section.id)"
      >
        <div class="flex items-center justify-between gap-2">
          <div class="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
            <Icon :icon="section.icon" class="w-5 h-5" />
          </div>
          <span class="badge badge-sm badge-primary badge-outline font-mono font-bold">{{ section.stat }}</span>
        </div>
        <div class="font-black text-sm leading-snug">{{ section.title }}</div>
        <p class="text-[11px] text-base-content/70 leading-relaxed">{{ section.summary }}</p>
        <div class="flex items-center justify-between gap-2 pt-1">
          <a
            v-if="showMemberActions && section.href"
            :href="section.href"
            class="btn btn-xs btn-primary text-primary-content rounded-lg gap-1 font-bold"
            @click.stop
          >
            <span>Open page</span>
            <Icon icon="solar:arrow-right-linear" class="w-3.5 h-3.5 shrink-0" />
          </a>
          <span v-else class="text-[11px] font-semibold opacity-60">Members get a live page</span>
          <button
            type="button"
            class="text-[11px] font-bold text-primary hover:underline"
            @click.stop="selectSection(section.id)"
          >
            {{ activeSection === section.id ? 'Reading ↓' : 'Read ↓' }}
          </button>
        </div>
      </div>
    </div>

    <!-- CONNECT WITH US SLIDE-OVER DRAWER (Guests) -->
    <SlideOverDrawer
      v-model="showConnectModal"
      title="🤝 Connect with The Huckleberry Collective"
      subtitle="Tell us how you'd like to be part of it — we'll email you a link to verify."
    >
      <ConnectWithUsForm v-if="showConnectModal" :hats="joinRoleCards" @close="showConnectModal = false" />
    </SlideOverDrawer>

    <!-- SERVER-RENDERED CHARTER SECTIONS + INTERACTIVE PAYOUT SIMULATOR -->
    <div
      v-for="section in sections"
      :key="`panel-${section.id}`"
      v-show="activeSection === section.id"
      class="space-y-6 charter-print-section"
    >
      <CharterPayoutSimulator v-if="section.id === 'payouts'" :is-authenticated="showMemberActions" />

      <article class="card bg-base-100 border border-base-300 shadow-md rounded-3xl overflow-hidden">
        <div class="card-body p-6 sm:p-8 space-y-5">
          <header class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-base-200 pb-5">
            <div class="flex items-start gap-3">
              <div class="w-10 h-10 rounded-xl bg-primary/15 text-primary flex items-center justify-center shrink-0 mt-0.5">
                <Icon :icon="section.icon" class="w-6 h-6" />
              </div>
              <div class="space-y-1">
                <div class="flex items-center gap-2 flex-wrap">
                  <span class="badge badge-primary badge-outline badge-xs font-mono font-bold">{{ section.stat }}</span>
                </div>
                <h2 class="text-xl sm:text-2xl font-black text-base-content tracking-tight">
                  {{ section.title }}
                </h2>
                <p class="text-xs sm:text-sm text-base-content/70 leading-relaxed">
                  {{ section.summary }}
                </p>
              </div>
            </div>

            <a
              v-if="showMemberActions && section.href"
              :href="section.href"
              class="btn btn-sm btn-primary text-primary-content rounded-xl font-black gap-1.5 shrink-0 print:hidden"
            >
              <span>{{ section.ctaLabel }}</span>
              <Icon icon="solar:arrow-right-bold" class="w-4 h-4 shrink-0" />
            </a>
          </header>

          <div
            class="prose prose-sm sm:prose-base max-w-none text-base-content prose-headings:font-black prose-headings:tracking-tight prose-table:text-xs sm:prose-table:text-sm prose-th:bg-base-200/70 prose-th:px-3 prose-th:py-2 prose-td:px-3 prose-td:py-2 prose-blockquote:border-primary prose-blockquote:bg-primary/5 prose-blockquote:rounded-r-xl prose-blockquote:py-2 prose-blockquote:px-4"
            v-html="section.html"
          ></div>
        </div>
      </article>
    </div>

    <!-- Bottom Call-to-Action -->
    <div class="rounded-3xl bg-base-200 p-6 sm:p-8 border border-base-300 flex flex-col sm:flex-row items-center justify-between gap-4 print:hidden">
      <div class="space-y-1 text-center sm:text-left">
        <h3 class="text-lg font-black text-base-content">Ready to Curate Together?</h3>
        <p class="text-xs text-base-content/70">Equal partners. Transparent numbers. Shared prosperity.</p>
      </div>
      <div class="flex flex-wrap items-center gap-3">
        <template v-if="showMemberActions">
          <a href="/sales/import" class="btn btn-sm btn-outline gap-1.5 font-bold rounded-xl">
            <Icon icon="solar:document-medicine-bold" class="w-4 h-4 text-primary shrink-0" />
            <span>Sales &amp; Settlements</span>
          </a>
          <a href="/settings" class="btn btn-sm btn-outline font-bold rounded-xl">Partner Settings</a>
          <a href="/scout" class="btn btn-sm btn-primary text-primary-content font-bold rounded-xl">Start Scouting Inventory</a>
        </template>
        <template v-else>
          <button type="button" class="btn btn-sm btn-primary text-primary-content font-bold rounded-xl" @click="showConnectModal = true">
            Connect With Us
          </button>
          <a href="/scout" class="btn btn-sm btn-outline font-bold rounded-xl">Try AI Scout Preview</a>
          <a href="/demo" class="btn btn-sm btn-outline font-bold rounded-xl">See the example dashboard</a>
          <a href="/login" class="btn btn-sm btn-outline font-bold rounded-xl">Member Login</a>
        </template>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { Icon } from '@iconify/vue';
import { addToast } from '../../stores/toast';
import { useAuth } from '../../composables/useAuth';
import SlideOverDrawer from '../common/SlideOverDrawer.vue';
import ConnectWithUsForm from './ConnectWithUsForm.vue';
import CharterPayoutSimulator from './CharterPayoutSimulator.vue';
import type { CharterRoleCard, CharterSectionId, CharterSectionView } from '../../lib/charterCms';

const VALID_SECTION_IDS: readonly CharterSectionId[] = ['payouts', 'monthly', 'expenses', 'governance', 'legal'];

const props = withDefaults(
  defineProps<{
    sections: CharterSectionView[];
    roleCards: CharterRoleCard[];
    initialSection?: CharterSectionId;
    initialAuthenticated?: boolean;
    primaryBoothRentLabel?: string;
    curatorPct?: number;
    commonsPct?: number;
  }>(),
  {
    initialSection: 'payouts',
    initialAuthenticated: false,
    primaryBoothRentLabel: '$382.50',
    curatorPct: 70,
    commonsPct: 30,
  }
);

const { isAuthenticated, loading } = useAuth();
const showMemberActions = computed(() => isAuthenticated.value || (loading.value && props.initialAuthenticated));

const activeSection = ref<CharterSectionId>(props.initialSection || 'payouts');
const showConnectModal = ref(false);
const copiedLink = ref(false);

const joinRoleCards = computed(() => props.roleCards.filter((r) => r.showInJoinGrid));

const selectSection = (id: CharterSectionId) => {
  activeSection.value = id;
  if (typeof window === 'undefined') return;
  try {
    const url = new URL(window.location.href);
    url.searchParams.delete('tab');
    if (id === 'payouts') {
      url.searchParams.delete('section');
    } else {
      url.searchParams.set('section', id);
    }
    window.history.replaceState(null, '', url.pathname + url.search + url.hash);
  } catch {
    // Ignore history API errors in embedded contexts
  }
};

const handlePrint = () => {
  if (typeof window !== 'undefined') {
    window.print();
  }
};

const copyShareLink = async () => {
  try {
    const suffix = activeSection.value !== 'payouts' ? `?section=${activeSection.value}` : '';
    const url = `${window.location.origin}/coop${suffix}`;
    await navigator.clipboard.writeText(url);
    copiedLink.value = true;
    addToast({ type: 'success', message: 'Charter link copied to clipboard!' });
    setTimeout(() => {
      copiedLink.value = false;
    }, 2500);
  } catch {
    addToast({ type: 'error', message: 'Could not copy link' });
  }
};

onMounted(() => {
  try {
    const params = new URLSearchParams(window.location.search);
    const sec = params.get('section') || params.get('tab');
    if (sec && (VALID_SECTION_IDS as readonly string[]).includes(sec)) {
      activeSection.value = sec as CharterSectionId;
    }
  } catch {
    // Keep initialSection from SSR
  }
});
</script>

<style scoped>
@media print {
  .charter-print-section {
    display: block !important;
  }
}
</style>


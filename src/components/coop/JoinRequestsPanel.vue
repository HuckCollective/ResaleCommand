<template>
  <div
    v-if="showSummaryCard || trayOpen || !!selected"
    class="card bg-base-100 border border-info/30 shadow-sm rounded-2xl"
    :class="{ 'hidden': !showSummaryCard }"
  >
    <div v-if="showSummaryCard" class="p-4 space-y-3">
      <div class="flex flex-wrap items-center justify-between gap-2">
        <div class="flex flex-wrap items-center gap-1.5 min-w-0">
          <h3 class="font-black text-sm flex items-center gap-1.5">
            <Icon icon="solar:user-plus-bold-duotone" class="w-5 h-5 text-info shrink-0" />
            <span>Co-op Join Requests</span>
          </h3>
          <span v-if="unverifiedCount > 0" class="text-[11px] font-semibold text-base-content/50 whitespace-nowrap">
            {{ unverifiedCount }} unverified
          </span>
        </div>
        <span v-if="loading" class="loading loading-spinner loading-xs"></span>
      </div>

      <!-- Non-Production Host Banner & Email Link Target Toggle -->
      <div
        v-if="isNonProdHost"
        class="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-warning/40 bg-warning/10 px-3 py-2 text-xs"
      >
        <div class="font-bold">
          ⚠️ Testing on <code class="font-mono">{{ currentHostLabel }}</code> — Email links will point to:
          <code class="font-mono underline">{{ targetHostLabel }}</code>
        </div>
        <div class="flex items-center gap-1">
          <button
            type="button"
            class="btn btn-xs rounded-lg font-bold"
            :class="!useProdOrigin ? 'btn-warning' : 'btn-ghost'"
            @click="useProdOrigin = false"
          >
            🧪 {{ currentHostLabel }}
          </button>
          <button
            type="button"
            class="btn btn-xs rounded-lg font-bold"
            :class="useProdOrigin ? 'btn-primary' : 'btn-ghost'"
            @click="useProdOrigin = true"
          >
            🌐 {{ prodHostLabel }}
          </button>
        </div>
      </div>

      <!-- 3 Summary Cards (tap to open the queue tray) -->
      <div class="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
        <button
          v-for="b in buckets"
          :key="b.id"
          type="button"
          class="text-left rounded-2xl border p-3 transition-all hover:shadow-md active:scale-[0.99] flex flex-col gap-1.5 min-w-0"
          :class="b.cardClass"
          @click="openTray(b.id)"
        >
          <div class="flex items-center justify-between gap-2">
            <span class="text-[11px] font-extrabold uppercase tracking-wider opacity-70 truncate">{{ b.icon }} {{ b.label }}</span>
            <span class="badge font-black shrink-0" :class="b.badgeClass">{{ b.items.length }}</span>
          </div>
          <div v-if="b.items.length" class="text-xs font-semibold truncate">
            {{ b.items.slice(0, 3).map((r) => r.name).join(', ') }}<span v-if="b.items.length > 3"> +{{ b.items.length - 3 }}</span>
          </div>
          <div v-else class="text-xs opacity-50 italic">{{ b.empty }}</div>
          <div class="text-[11px] font-bold text-primary">Open list →</div>
        </button>
      </div>
    </div>

    <!-- Queue Bottom Sheet Tray -->
    <Teleport v-if="mounted" to="body">
      <div v-if="trayOpen" class="fixed inset-0 z-[390] bg-black/60 flex flex-col justify-end" @click.self="trayOpen = false">
        <div class="bg-base-100 border-t border-base-300 rounded-t-3xl max-w-2xl mx-auto w-full max-h-[85dvh] flex flex-col shadow-2xl overflow-hidden">
          <div class="w-12 h-1.5 bg-base-content/20 rounded-full mx-auto mt-2.5 mb-1 shrink-0"></div>
          <div class="px-4 py-2.5 border-b border-base-300 flex items-center justify-between gap-2 shrink-0">
            <h4 class="font-black text-sm">Join Queue</h4>
            <button type="button" class="btn btn-ghost btn-sm btn-circle" aria-label="Close" @click="trayOpen = false">✕</button>
          </div>
          <div class="px-3 pt-2 grid grid-cols-3 gap-1.5 shrink-0">
            <button
              v-for="b in buckets"
              :key="b.id"
              type="button"
              class="btn btn-xs h-8 rounded-xl font-bold px-1"
              :class="trayTab === b.id ? 'btn-primary' : 'btn-ghost border border-base-300'"
              @click="trayTab = b.id"
            >
              {{ b.icon }} {{ b.short }} ({{ b.items.length }})
            </button>
          </div>
          <div v-if="isNonProdHost" class="px-4 pt-2 text-[11px] font-mono text-warning shrink-0">
            ⚠️ Email links → {{ targetHostLabel }}
          </div>
          <div class="flex-1 min-h-0 overflow-y-auto p-3 space-y-2">
            <button
              v-for="req in trayItems"
              :key="req.id"
              type="button"
              class="w-full text-left rounded-xl border border-base-300 bg-base-200/40 hover:bg-base-200 px-3 py-2.5 space-y-1"
              @click="selectedId = req.id"
            >
              <div class="flex items-start justify-between gap-2">
                <div class="min-w-0">
                  <div class="font-bold text-sm break-words">{{ req.name }}</div>
                  <div class="text-xs text-base-content/70 break-all">{{ req.email }}</div>
                </div>
                <div class="flex flex-col items-end gap-1 shrink-0">
                  <span v-if="req.status === JOIN_REQUEST_STATUS.needs_info" class="badge badge-warning badge-xs font-bold">Awaiting reply</span>
                  <span v-else-if="req.applicantReply" class="badge badge-info badge-xs font-bold">Answered</span>
                  <span class="text-[11px] font-bold text-primary whitespace-nowrap">Review →</span>
                </div>
              </div>
              <div class="flex flex-wrap gap-1">
                <span v-for="hat in req.hats" :key="hat" class="badge badge-xs badge-primary badge-outline font-bold">{{ hat }}</span>
                <span v-for="niche in req.niches" :key="niche" class="badge badge-xs badge-outline">{{ niche }}</span>
              </div>
            </button>
            <div v-if="trayItems.length === 0" class="text-center text-xs text-base-content/50 italic py-8">Nothing here right now.</div>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- Lazy-Mounted Applicant Review & Decision Drawer -->
    <JoinApplicantDrawer
      v-if="selected"
      :selected="selected"
      :use-prod-origin="useProdOrigin"
      :target-host-label="targetHostLabel"
      @close="selectedId = ''"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { Icon } from '@iconify/vue';
import JoinApplicantDrawer from './JoinApplicantDrawer.vue';
import { JOIN_REQUEST_STATUS, type JoinRequest } from '../../lib/joinRequests';
import { joinApi } from '../../lib/joinRequestsClient';
import { siteConfig } from '../../site-config';

type BucketId = 'waiting' | 'waitlist' | 'invited';

const props = withDefaults(
  defineProps<{
    inlineVisible?: boolean;
  }>(),
  {
    inlineVisible: true,
  }
);

const mounted = ref(false);
const allRequests = ref<JoinRequest[]>([]);
const unverifiedCount = ref(0);
const loading = ref(true);
const currentOrigin = ref('');
const useProdOrigin = ref(false);
const trayOpen = ref(false);
const trayTab = ref<BucketId>('waiting');
const selectedId = ref('');

const prodHostLabel = computed(() => {
  try {
    return new URL(siteConfig.siteUrl).host;
  } catch {
    return siteConfig.siteUrl;
  }
});

const currentHostLabel = computed(() => {
  if (!currentOrigin.value) return prodHostLabel.value;
  try {
    return new URL(currentOrigin.value).host;
  } catch {
    return currentOrigin.value;
  }
});

const isNonProdHost = computed(() => {
  if (!currentOrigin.value) return false;
  return /^(localhost|127\.0\.0\.1|alpha\.)/i.test(currentHostLabel.value);
});

const targetHostLabel = computed(() => (useProdOrigin.value ? prodHostLabel.value : currentHostLabel.value));

const activeRequests = computed(() =>
  allRequests.value.filter(
    (r) => r.status === JOIN_REQUEST_STATUS.pending || r.status === JOIN_REQUEST_STATUS.needs_info
  )
);
const waitlistedRequests = computed(() =>
  allRequests.value.filter((r) => r.status === JOIN_REQUEST_STATUS.waitlisted)
);
const approvedRequests = computed(() =>
  allRequests.value.filter((r) => r.status === JOIN_REQUEST_STATUS.approved)
);

const hasAnyRequests = computed(
  () => loading.value || activeRequests.value.length > 0 || approvedRequests.value.length > 0 || waitlistedRequests.value.length > 0
);
const showSummaryCard = computed(() => props.inlineVisible && hasAnyRequests.value);

const buckets = computed(() => [
  {
    id: 'waiting' as BucketId,
    icon: '📬',
    label: 'Join Requests',
    short: 'Waiting',
    empty: 'No one waiting',
    items: activeRequests.value,
    cardClass: 'border-info/40 bg-info/5',
    badgeClass: 'badge-info',
  },
  {
    id: 'waitlist' as BucketId,
    icon: '⏳',
    label: 'Priority Waitlist',
    short: 'Waitlist',
    empty: 'Waitlist is empty',
    items: waitlistedRequests.value,
    cardClass: 'border-warning/40 bg-warning/5',
    badgeClass: 'badge-warning',
  },
  {
    id: 'invited' as BucketId,
    icon: '✅',
    label: 'Approved Invites',
    short: 'Invited',
    empty: 'No open invites',
    items: approvedRequests.value,
    cardClass: 'border-success/40 bg-success/5',
    badgeClass: 'badge-success',
  },
]);

const trayItems = computed(() => buckets.value.find((b) => b.id === trayTab.value)?.items ?? []);
const selected = computed(() => allRequests.value.find((r) => r.id === selectedId.value) || null);

const openTray = (id: BucketId) => {
  trayTab.value = id;
  trayOpen.value = true;
};

const load = async () => {
  try {
    const res = await joinApi<{ requests: JoinRequest[]; unverifiedCount: number }>('list', {}, { steward: true });
    if (res.ok) {
      allRequests.value = res.data.requests || [];
      unverifiedCount.value = res.data.unverifiedCount || 0;
    }
  } catch (err) {
    console.warn('[JoinRequestsPanel] Could not load join requests:', err);
  } finally {
    loading.value = false;
  }
};

const handleExternalOpenTray = () => {
  const defaultBucket: BucketId =
    activeRequests.value.length > 0 ? 'waiting' : waitlistedRequests.value.length > 0 ? 'waitlist' : 'invited';
  trayTab.value = defaultBucket;
  trayOpen.value = true;
};

onMounted(() => {
  mounted.value = true;
  if (typeof window !== 'undefined') {
    currentOrigin.value = window.location.origin;
    window.addEventListener('rc:open-join-queue-tray', handleExternalOpenTray);
  }
  load();
});

onUnmounted(() => {
  if (typeof window !== 'undefined') {
    window.removeEventListener('rc:open-join-queue-tray', handleExternalOpenTray);
  }
});
</script>

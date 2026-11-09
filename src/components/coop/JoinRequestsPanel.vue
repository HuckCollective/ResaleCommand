<template>
  <div
    v-if="loading || activeRequests.length > 0 || approvedRequests.length > 0 || waitlistedRequests.length > 0"
    class="card bg-base-100 border border-info/30 shadow-sm rounded-2xl"
  >
    <div class="p-4 space-y-3">
      <div class="flex flex-wrap items-center justify-between gap-2">
        <div class="flex flex-wrap items-center gap-1.5 min-w-0">
          <h3 class="font-black text-sm flex items-center gap-1.5">
            <Icon icon="solar:user-plus-bold-duotone" class="w-5 h-5 text-info shrink-0" />
            <span>Co-op Join Requests</span>
          </h3>
          <span v-if="unverifiedCount > 0" class="text-[11px] font-semibold text-base-content/50 whitespace-nowrap">{{ unverifiedCount }} unverified</span>
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
          <code class="font-mono underline">{{ useProdOrigin ? prodHostLabel : currentHostLabel }}</code>
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
            ⚠️ Email links → {{ useProdOrigin ? prodHostLabel : currentHostLabel }}
          </div>
          <div class="flex-1 min-h-0 overflow-y-auto p-3 space-y-2">
            <button
              v-for="req in trayItems"
              :key="req.id"
              type="button"
              class="w-full text-left rounded-xl border border-base-300 bg-base-200/40 hover:bg-base-200 px-3 py-2.5 space-y-1"
              @click="openDrawer(req)"
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

    <!-- Applicant Review & Decision Drawer -->
    <SlideOverDrawer
      v-model="drawerOpen"
      :title="selected?.name || 'Applicant'"
      :subtitle="selected?.email || ''"
    >
      <div v-if="selected" class="space-y-4">
        <div class="flex flex-wrap items-center gap-1.5">
          <span class="badge badge-sm font-bold" :class="statusBadgeClass">{{ statusLabel }}</span>
          <span v-if="selected.applicantReply && selected.status !== JOIN_REQUEST_STATUS.needs_info" class="badge badge-info badge-sm font-bold">Answered Question</span>
        </div>

        <!-- Read view -->
        <div v-if="!editing" class="space-y-3">
          <div class="flex justify-end">
            <button type="button" class="btn btn-xs btn-outline rounded-lg font-bold" :disabled="!!busyId" @click="startEdit">✏️ Edit Details</button>
          </div>
          <div class="flex flex-wrap gap-1">
            <span v-for="hat in selected.hats" :key="hat" class="badge badge-sm badge-primary badge-outline font-bold">{{ hat }}</span>
            <span v-for="niche in selected.niches" :key="niche" class="badge badge-sm badge-outline">{{ niche }}</span>
          </div>
          <a
            v-if="selected.socialUrl"
            :href="formatExternalUrl(selected.socialUrl)"
            target="_blank"
            rel="noopener noreferrer"
            class="text-xs link link-primary font-bold break-all block"
          >
            🔗 {{ selected.socialUrl }}
          </a>
          <p v-if="selected.note" class="text-xs break-words whitespace-pre-line bg-base-200/60 rounded-lg p-2.5 border border-base-300/60">{{ selected.note }}</p>
          <div v-if="selected.stewardQuestion" class="rounded-lg bg-info/10 border border-info/30 p-2.5 text-xs space-y-1">
            <div><span class="font-bold">Steward Question:</span> {{ selected.stewardQuestion }}</div>
            <div v-if="selected.applicantReply" class="text-success font-bold">Applicant Reply: {{ selected.applicantReply }}</div>
          </div>
        </div>

        <!-- Edit view -->
        <div v-else class="space-y-3 text-xs">
          <div class="form-control">
            <label class="label py-1"><span class="label-text font-bold text-xs">Name</span></label>
            <input v-model="editDraft.name" type="text" maxlength="80" class="input input-bordered input-sm rounded-xl" />
          </div>
          <div>
            <div class="label-text font-bold text-xs py-1">Hats</div>
            <div class="flex flex-wrap gap-1.5">
              <button
                v-for="h in hatOptions"
                :key="h.id"
                type="button"
                class="btn btn-xs rounded-lg font-bold"
                :class="editDraft.hats.includes(h.id) ? 'btn-primary' : 'btn-ghost border border-base-300'"
                @click="toggleEditHat(h.id)"
              >
                {{ h.icon }} {{ h.title }}
              </button>
            </div>
          </div>
          <div class="form-control">
            <label class="label py-1"><span class="label-text font-bold text-xs">Focus / Specialty (comma separated)</span></label>
            <input v-model="editDraft.niches" type="text" class="input input-bordered input-sm rounded-xl" />
          </div>
          <div class="form-control">
            <label class="label py-1"><span class="label-text font-bold text-xs">Shop / Social</span></label>
            <input v-model="editDraft.socialUrl" type="text" class="input input-bordered input-sm rounded-xl" />
          </div>
          <div class="form-control">
            <label class="label py-1"><span class="label-text font-bold text-xs">Notes</span></label>
            <textarea v-model="editDraft.note" rows="4" class="textarea textarea-bordered rounded-xl text-xs"></textarea>
          </div>
          <div class="flex justify-end gap-2">
            <button type="button" class="btn btn-sm btn-ghost rounded-xl" :disabled="savingEdit" @click="editing = false">Cancel</button>
            <button type="button" class="btn btn-sm btn-primary rounded-xl font-black" :disabled="savingEdit || !editDraft.name.trim() || editDraft.hats.length === 0" @click="saveEdit">
              <span v-if="savingEdit" class="loading loading-spinner loading-xs"></span>
              Save Changes
            </button>
          </div>
        </div>
      </div>

      <template #footer>
        <div v-if="selected" class="space-y-2">
          <!-- Ask 1 Question box -->
          <div v-if="questionOpen" class="flex flex-col gap-2 bg-info/10 border border-info/30 rounded-xl p-2.5">
            <input
              v-model="questionDraft"
              type="text"
              maxlength="280"
              placeholder="Ask 1 quick question (they answer on the site, not by email)..."
              class="input input-bordered input-xs rounded-lg text-xs"
              @keydown.enter.prevent="sendDecision(selected, 'needs_info', questionDraft)"
            />
            <div class="flex gap-2 justify-end">
              <button type="button" class="btn btn-xs btn-ghost rounded-lg" @click="questionOpen = false">Cancel</button>
              <button
                type="button"
                class="btn btn-xs btn-info rounded-lg font-bold"
                :disabled="busyId === selected.id || !questionDraft.trim()"
                @click="sendDecision(selected, 'needs_info', questionDraft)"
              >
                <span v-if="busyId === selected.id" class="loading loading-spinner loading-xs"></span>
                📨 Send On-Page Question
              </button>
            </div>
          </div>

          <!-- Pending / needs info -->
          <div v-else-if="isActive(selected)" class="flex flex-wrap items-center justify-end gap-1.5">
            <button type="button" class="btn btn-xs btn-ghost rounded-lg text-base-content/60" :disabled="busyId === selected.id" @click="promptDecision(selected, 'decline_silent')">Archive Silently</button>
            <button type="button" class="btn btn-xs btn-outline btn-error rounded-lg font-bold" :disabled="busyId === selected.id" @click="promptDecision(selected, 'decline_category')">✖ Decline (Category Fit)</button>
            <button type="button" class="btn btn-xs btn-outline rounded-lg font-bold" :disabled="busyId === selected.id" @click="promptDecision(selected, 'decline_capacity')">✖ Decline (Full Roster)</button>
            <button type="button" class="btn btn-xs btn-outline btn-warning rounded-lg font-bold" :disabled="busyId === selected.id" @click="promptDecision(selected, 'waitlist')">⏳ Waitlist</button>
            <button type="button" class="btn btn-xs btn-outline btn-info rounded-lg font-bold" :disabled="busyId === selected.id" @click="openQuestionBox(selected)">💬 Ask 1 Question</button>
            <button type="button" class="btn btn-xs btn-primary rounded-lg font-black" :disabled="busyId === selected.id" @click="promptDecision(selected, 'approve')">✅ Approve &amp; Send Invite</button>
          </div>

          <!-- Waitlisted -->
          <div v-else-if="selected.status === JOIN_REQUEST_STATUS.waitlisted" class="flex flex-wrap items-center justify-end gap-1.5">
            <button type="button" class="btn btn-xs btn-ghost text-base-content/60 rounded-lg" :disabled="busyId === selected.id" @click="promptDecision(selected, 'decline_silent')">Remove</button>
            <button type="button" class="btn btn-xs btn-outline btn-info rounded-lg font-bold" :disabled="busyId === selected.id" @click="sendDecision(selected, 'reopen')">↩️ Back to Review</button>
            <button type="button" class="btn btn-xs btn-primary rounded-lg font-bold" :disabled="busyId === selected.id" @click="promptDecision(selected, 'approve')">✅ Approve &amp; Send Invite</button>
          </div>

          <!-- Approved (waiting to create password) -->
          <div v-else-if="selected.status === JOIN_REQUEST_STATUS.approved" class="flex flex-wrap items-center justify-end gap-1.5">
            <button type="button" class="btn btn-xs btn-ghost text-base-content/60 rounded-lg" :disabled="busyId === selected.id" @click="promptDecision(selected, 'decline_silent')">Revoke</button>
            <button type="button" class="btn btn-xs btn-outline btn-info rounded-lg font-bold" :disabled="busyId === selected.id" title="Move back to review queue without sending an email" @click="sendDecision(selected, 'reopen')">↩️ Back to Review</button>
            <button type="button" class="btn btn-xs btn-ghost rounded-lg font-bold" :disabled="busyId === selected.id" @click="promptDecision(selected, 'approve')">Resend Invite Email</button>
            <button type="button" class="btn btn-xs btn-outline rounded-lg font-bold" @click="copyInviteLink(selected)">Copy Invite Link</button>
          </div>
        </div>
      </template>
    </SlideOverDrawer>

    <!-- Decision Confirmation Modal -->
    <dialog class="modal modal-bottom sm:modal-middle z-[500]" :class="{ 'modal-open': !!pendingConfirm }">
      <div v-if="pendingConfirm" class="modal-box rounded-t-3xl sm:rounded-3xl border border-base-300 space-y-4">
        <div class="flex items-start justify-between gap-3">
          <div>
            <div class="text-[11px] font-bold uppercase tracking-wider text-base-content/60">
              Confirm Steward Decision
            </div>
            <h4 class="font-black text-base mt-0.5">{{ confirmModalMeta.title }}</h4>
          </div>
          <button type="button" class="btn btn-sm btn-circle btn-ghost" @click="pendingConfirm = null">✕</button>
        </div>

        <div class="rounded-xl bg-base-200/70 border border-base-300 px-3.5 py-2.5 text-xs space-y-1">
          <div>
            <span class="font-bold">Applicant:</span> {{ pendingConfirm.req.name }}
            <span class="text-base-content/70">({{ pendingConfirm.req.email }})</span>
          </div>
          <div v-if="pendingConfirm.req.hats.length">
            <span class="font-bold">Hats:</span> {{ pendingConfirm.req.hats.join(', ') }}
          </div>
        </div>

        <div class="rounded-xl border px-3.5 py-2.5 text-xs space-y-1.5" :class="confirmModalMeta.boxClass">
          <div class="font-bold">{{ confirmModalMeta.summary }}</div>
          <div v-if="confirmModalMeta.emailSubject" class="text-base-content/80">
            <span class="font-semibold">Email Subject:</span> "{{ confirmModalMeta.emailSubject }}"
          </div>
          <div v-if="confirmModalMeta.emailPreview" class="text-base-content/75 italic">
            "{{ confirmModalMeta.emailPreview }}"
          </div>
          <div v-if="confirmModalMeta.sendsEmail" class="pt-1 font-mono text-[11px] text-base-content/70">
            Link host in email: <strong>{{ useProdOrigin ? prodHostLabel : currentHostLabel }}</strong>
          </div>
        </div>

        <div class="modal-action mt-2">
          <button
            type="button"
            class="btn btn-sm btn-ghost rounded-xl"
            :disabled="!!busyId"
            @click="pendingConfirm = null"
          >
            Cancel
          </button>
          <button
            type="button"
            class="btn btn-sm rounded-xl font-black"
            :class="confirmModalMeta.btnClass"
            :disabled="!!busyId"
            @click="confirmAndSendDecision"
          >
            <span v-if="busyId" class="loading loading-spinner loading-xs"></span>
            {{ confirmModalMeta.cta }}
          </button>
        </div>
      </div>
      <form method="dialog" class="modal-backdrop" @click="pendingConfirm = null">
        <button type="button">close</button>
      </form>
    </dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { Icon } from '@iconify/vue';
import { addToast } from '../../stores/toast';
import SlideOverDrawer from '../common/SlideOverDrawer.vue';
import {
  JOIN_DECISION_TEMPLATES,
  JOIN_REQUEST_HAT_OPTIONS,
  JOIN_REQUEST_STATUS,
  type JoinDecisionKey,
  type JoinRequest,
  type JoinRequestHat,
  type JoinRequestStatus,
} from '../../lib/joinRequests';
import { joinApi } from '../../lib/joinRequestsClient';
import { siteConfig } from '../../site-config';

type BucketId = 'waiting' | 'waitlist' | 'invited';

const hatOptions = JOIN_REQUEST_HAT_OPTIONS;
const mounted = ref(false);
const allRequests = ref<JoinRequest[]>([]);
const unverifiedCount = ref(0);
const loading = ref(true);
const busyId = ref('');
const questionOpen = ref(false);
const questionDraft = ref('');
const pendingConfirm = ref<{ req: JoinRequest; decision: JoinDecisionKey } | null>(null);
const currentOrigin = ref('');
const useProdOrigin = ref(false);

const trayOpen = ref(false);
const trayTab = ref<BucketId>('waiting');
const selectedId = ref('');
const editing = ref(false);
const savingEdit = ref(false);
const editDraft = ref({ name: '', hats: [] as JoinRequestHat[], niches: '', socialUrl: '', note: '' });

const confirmModalMeta = computed(() => {
  const item = pendingConfirm.value;
  if (!item) {
    return {
      title: '',
      summary: '',
      emailSubject: '',
      emailPreview: '',
      sendsEmail: false,
      boxClass: 'border-base-300 bg-base-200/40',
      btnClass: 'btn-primary',
      cta: 'Confirm',
    };
  }
  const d = item.decision;
  if (d === 'approve') {
    return {
      title: '✅ Approve & Send Official Invite?',
      summary: 'Approves this applicant and emails their personal invite link to create a password.',
      emailSubject: JOIN_DECISION_TEMPLATES.approve.subject,
      emailPreview: JOIN_DECISION_TEMPLATES.approve.message,
      sendsEmail: true,
      boxClass: 'border-success/40 bg-success/10',
      btnClass: 'btn-success',
      cta: '✅ Yes, Approve & Send Email',
    };
  }
  if (d === 'waitlist') {
    return {
      title: '⏳ Move to Priority Waitlist?',
      summary: 'Places this applicant on the Priority Waitlist and emails the waitlist notification.',
      emailSubject: JOIN_DECISION_TEMPLATES.waitlist.subject,
      emailPreview: JOIN_DECISION_TEMPLATES.waitlist.message,
      sendsEmail: true,
      boxClass: 'border-warning/40 bg-warning/10',
      btnClass: 'btn-warning',
      cta: '⏳ Yes, Waitlist & Send Email',
    };
  }
  if (d === 'decline_category') {
    return {
      title: '✖ Decline (Not a Category Fit)?',
      summary: 'Declines this application and sends the polite category-fit response email.',
      emailSubject: JOIN_DECISION_TEMPLATES.decline_category.subject,
      emailPreview: JOIN_DECISION_TEMPLATES.decline_category.message,
      sendsEmail: true,
      boxClass: 'border-error/40 bg-error/10',
      btnClass: 'btn-error',
      cta: '✖ Yes, Decline & Send Email',
    };
  }
  if (d === 'decline_capacity') {
    return {
      title: '✖ Decline (Full Roster)?',
      summary: 'Declines this application and sends the polite roster-at-capacity response email.',
      emailSubject: JOIN_DECISION_TEMPLATES.decline_capacity.subject,
      emailPreview: JOIN_DECISION_TEMPLATES.decline_capacity.message,
      sendsEmail: true,
      boxClass: 'border-error/40 bg-error/10',
      btnClass: 'btn-error',
      cta: '✖ Yes, Decline & Send Email',
    };
  }
  return {
    title: 'Archive Silently (No Email)?',
    summary: 'Archives this application immediately without sending any email to the applicant.',
    emailSubject: '',
    emailPreview: '',
    sendsEmail: false,
    boxClass: 'border-base-300 bg-base-200/50',
    btnClass: 'btn-neutral',
    cta: 'Yes, Archive Silently',
  };
});

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

const activeRequests = computed(() =>
  allRequests.value.filter(
    (r) => r.status === JOIN_REQUEST_STATUS.pending || r.status === JOIN_REQUEST_STATUS.needs_info
  )
);
const waitlistedRequests = computed(() =>
  allRequests.value.filter((r) => r.status === JOIN_REQUEST_STATUS.waitlisted)
);
// Approved people leave this list automatically once they create their account (status becomes `joined`).
const approvedRequests = computed(() =>
  allRequests.value.filter((r) => r.status === JOIN_REQUEST_STATUS.approved)
);

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
const drawerOpen = computed({
  get: () => !!selected.value,
  set: (open: boolean) => {
    if (!open) {
      selectedId.value = '';
      editing.value = false;
      questionOpen.value = false;
    }
  },
});

const isActive = (r: JoinRequest) =>
  r.status === JOIN_REQUEST_STATUS.pending || r.status === JOIN_REQUEST_STATUS.needs_info;

const statusLabel = computed(() => {
  const s = selected.value?.status;
  if (s === JOIN_REQUEST_STATUS.needs_info) return 'Waiting for On-Page Reply';
  if (s === JOIN_REQUEST_STATUS.waitlisted) return 'Waitlisted';
  if (s === JOIN_REQUEST_STATUS.approved) return 'Invited — waiting to create password';
  return 'Waiting for review';
});
const statusBadgeClass = computed(() => {
  const s = selected.value?.status;
  if (s === JOIN_REQUEST_STATUS.needs_info || s === JOIN_REQUEST_STATUS.waitlisted) return 'badge-warning';
  if (s === JOIN_REQUEST_STATUS.approved) return 'badge-success';
  return 'badge-info';
});

const formatExternalUrl = (raw: string) => {
  const s = raw.trim();
  if (/^https?:\/\//i.test(s)) return s;
  if (s.startsWith('@')) return `https://instagram.com/${s.slice(1)}`;
  return `https://${s}`;
};

const openTray = (id: BucketId) => {
  trayTab.value = id;
  trayOpen.value = true;
};

const openDrawer = (req: JoinRequest) => {
  editing.value = false;
  questionOpen.value = false;
  selectedId.value = req.id;
};

const startEdit = () => {
  const r = selected.value;
  if (!r) return;
  editDraft.value = {
    name: r.name,
    hats: [...r.hats],
    niches: r.niches.join(', '),
    socialUrl: r.socialUrl || '',
    note: r.note || '',
  };
  editing.value = true;
};

const toggleEditHat = (id: JoinRequestHat) => {
  const hats = editDraft.value.hats;
  editDraft.value.hats = hats.includes(id) ? hats.filter((h) => h !== id) : [...hats, id];
};

const saveEdit = async () => {
  const r = selected.value;
  if (!r) return;
  savingEdit.value = true;
  try {
    const niches = editDraft.value.niches
      .split(',')
      .map((n) => n.trim())
      .filter(Boolean);
    const res = await joinApi(
      'steward_update',
      {
        id: r.id,
        name: editDraft.value.name,
        hats: editDraft.value.hats,
        niches,
        socialUrl: editDraft.value.socialUrl,
        note: editDraft.value.note,
      },
      { steward: true }
    );
    if (!res.ok) {
      addToast({ type: 'error', message: res.data.error || 'Could not save changes.' });
      return;
    }
    r.name = editDraft.value.name.trim();
    r.hats = [...editDraft.value.hats];
    r.niches = niches;
    r.socialUrl = editDraft.value.socialUrl.trim();
    r.note = editDraft.value.note.trim();
    editing.value = false;
    addToast({ type: 'success', message: `Saved changes for ${r.name}.` });
  } finally {
    savingEdit.value = false;
  }
};

/** The personal invite link is signed server-side, so the panel asks the API for it (steward-only). */
const copyInviteLink = async (req: JoinRequest) => {
  const res = await joinApi<{ inviteUrl: string }>(
    'link',
    { id: req.id, useProdOrigin: useProdOrigin.value },
    { steward: true }
  );
  if (!res.ok) {
    addToast({ type: 'error', message: res.data.error || 'Could not get the invite link.' });
    return;
  }
  const url = res.data.inviteUrl;
  try {
    await navigator.clipboard.writeText(url);
    addToast({ type: 'success', message: `Copied invite link for ${req.name}!` });
  } catch {
    addToast({ type: 'info', message: url });
  }
};

const openQuestionBox = (req: JoinRequest) => {
  pendingConfirm.value = null;
  questionOpen.value = true;
  questionDraft.value = req.stewardQuestion || 'What types of items or booth support are you looking to bring?';
};

const promptDecision = (req: JoinRequest, decision: JoinDecisionKey) => {
  questionOpen.value = false;
  pendingConfirm.value = { req, decision };
};

const confirmAndSendDecision = async () => {
  if (!pendingConfirm.value) return;
  const { req, decision } = pendingConfirm.value;
  await sendDecision(req, decision);
  pendingConfirm.value = null;
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

const sendDecision = async (req: JoinRequest, decision: JoinDecisionKey, questionText = '') => {
  busyId.value = req.id;
  try {
    const cleanQuestion = questionText.trim();
    const res = await joinApi<{ inviteUrl: string; emailSent: boolean; status: JoinRequestStatus }>(
      'decide',
      { id: req.id, decision, question: cleanQuestion, useProdOrigin: useProdOrigin.value },
      { steward: true }
    );
    if (!res.ok) {
      addToast({ type: 'error', message: res.data.error || 'Could not update the request.' });
      return;
    }

    req.status = res.data.status;
    req.decisionKey = decision;
    pendingConfirm.value = null;
    // The decision moves the person to another queue, so close their drawer.
    selectedId.value = '';
    editing.value = false;
    questionOpen.value = false;
    if (decision === 'needs_info') req.stewardQuestion = cleanQuestion;

    if (decision === 'approve') {
      try {
        await navigator.clipboard.writeText(res.data.inviteUrl);
      } catch {
        // Ignore clipboard errors
      }
      addToast({
        type: 'success',
        message: `Approved ${req.name}! Invite email sent & sign-up link copied.`,
      });
    } else if (decision === 'reopen') {
      addToast({
        type: 'info',
        message: `Moved ${req.name} back to review queue.`,
      });
    } else if (decision === 'waitlist') {
      addToast({
        type: 'info',
        message: `Added ${req.name} to waitlist & sent automated waitlist email.`,
      });
    } else if (decision === 'needs_info') {
      addToast({
        type: 'info',
        message: `Sent question to ${req.name} — they'll answer right on their application page.`,
      });
    } else if (decision === 'decline_silent') {
      addToast({ type: 'info', message: `Archived ${req.name}.` });
    } else {
      const label = JOIN_DECISION_TEMPLATES[decision as keyof typeof JOIN_DECISION_TEMPLATES]?.label || 'Declined';
      addToast({
        type: 'info',
        message: `${label}: Automated polite response sent to ${req.name}.`,
      });
    }
  } catch (err: any) {
    addToast({ type: 'error', message: err?.message || 'Could not update the request.' });
  } finally {
    busyId.value = '';
  }
};

onMounted(() => {
  mounted.value = true;
  if (typeof window !== 'undefined') {
    currentOrigin.value = window.location.origin;
  }
  load();
});
</script>

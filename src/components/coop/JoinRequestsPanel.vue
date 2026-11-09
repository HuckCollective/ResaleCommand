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
          <span v-if="activeRequests.length > 0" class="badge badge-info badge-sm font-bold whitespace-nowrap">{{ activeRequests.length }} waiting</span>
          <span v-if="approvedRequests.length > 0" class="badge badge-success badge-outline badge-sm font-bold whitespace-nowrap">{{ approvedRequests.length }} invited</span>
          <span v-if="waitlistedRequests.length > 0" class="badge badge-warning badge-outline badge-sm font-bold whitespace-nowrap">{{ waitlistedRequests.length }} waitlisted</span>
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

      <!-- Pending & Needs-Info Join Requests -->
      <div v-for="req in activeRequests" :key="req.id" class="rounded-xl border border-base-300 bg-base-200/40 p-3 space-y-2.5">
        <div class="flex flex-wrap items-start justify-between gap-2">
          <div class="min-w-0">
            <div class="flex flex-wrap items-center gap-1.5">
              <span class="font-bold text-sm break-words">{{ req.name }}</span>
              <span v-if="req.status === JOIN_REQUEST_STATUS.needs_info" class="badge badge-warning badge-xs font-bold">
                Waiting for On-Page Reply
              </span>
              <span v-else-if="req.applicantReply" class="badge badge-info badge-xs font-bold">
                Answered Question
              </span>
            </div>
            <div class="text-xs text-base-content/70 break-all">{{ req.email }}</div>
            <a
              v-if="req.socialUrl"
              :href="formatExternalUrl(req.socialUrl)"
              target="_blank"
              rel="noopener noreferrer"
              class="text-xs link link-primary font-bold break-all"
            >
              🔗 {{ req.socialUrl }}
            </a>
          </div>
          <div class="flex flex-wrap gap-1">
            <span v-for="hat in req.hats" :key="hat" class="badge badge-sm badge-primary badge-outline font-bold">{{ hat }}</span>
            <span v-for="niche in req.niches" :key="niche" class="badge badge-sm badge-outline">{{ niche }}</span>
          </div>
        </div>

        <p v-if="req.note" class="text-xs break-words whitespace-pre-line bg-base-100/70 rounded-lg p-2 border border-base-300/60">
          {{ req.note }}
        </p>

        <!-- Steward Question & Applicant On-Page Reply -->
        <div v-if="req.stewardQuestion" class="rounded-lg bg-info/10 border border-info/30 p-2 text-xs space-y-1">
          <div><span class="font-bold">Steward Question:</span> {{ req.stewardQuestion }}</div>
          <div v-if="req.applicantReply" class="text-success font-bold">
            Applicant Reply: {{ req.applicantReply }}
          </div>
        </div>

        <!-- Inline Ask 1 Question Drawer -->
        <div v-if="questionOpenForId === req.id" class="flex flex-col sm:flex-row gap-2 pt-1 bg-info/10 border border-info/30 rounded-xl p-2.5">
          <input
            v-model="questionDraft"
            type="text"
            maxlength="280"
            placeholder="Ask 1 quick question (they answer on the site, not by email)..."
            class="input input-bordered input-xs rounded-lg flex-1 text-xs"
            @keydown.enter.prevent="sendDecision(req, 'needs_info', questionDraft)"
          />
          <button
            type="button"
            class="btn btn-xs btn-info rounded-lg font-bold"
            :disabled="busyId === req.id || !questionDraft.trim()"
            @click="sendDecision(req, 'needs_info', questionDraft)"
          >
            <span v-if="busyId === req.id" class="loading loading-spinner loading-xs"></span>
            📨 Send On-Page Question
          </button>
          <button type="button" class="btn btn-xs btn-ghost rounded-lg" @click="questionOpenForId = ''">
            Cancel
          </button>
        </div>

        <!-- 1-Click Automated Decision Bar (Opens Confirmation Modal on Every Decision Except Ask 1 Question) -->
        <div v-else class="flex flex-wrap items-center justify-end gap-1.5 pt-1">
          <button
            type="button"
            class="btn btn-xs btn-ghost rounded-lg text-base-content/60"
            :disabled="busyId === req.id"
            title="Archive without sending any email"
            @click="promptDecision(req, 'decline_silent')"
          >
            Archive Silently
          </button>
          <button
            type="button"
            class="btn btn-xs btn-outline btn-error rounded-lg font-bold"
            :disabled="busyId === req.id"
            title="Sends polite 'Not a current category fit' template from the app"
            @click="promptDecision(req, 'decline_category')"
          >
            ✖ Decline (Category Fit)
          </button>
          <button
            type="button"
            class="btn btn-xs btn-outline rounded-lg font-bold"
            :disabled="busyId === req.id"
            title="Sends polite 'Booth / Roster at capacity' template from the app"
            @click="promptDecision(req, 'decline_capacity')"
          >
            ✖ Decline (Full Roster)
          </button>
          <button
            type="button"
            class="btn btn-xs btn-outline btn-warning rounded-lg font-bold"
            :disabled="busyId === req.id"
            title="Adds to waitlist & sends automated Waitlist email"
            @click="promptDecision(req, 'waitlist')"
          >
            ⏳ Waitlist
          </button>
          <button
            type="button"
            class="btn btn-xs btn-outline btn-info rounded-lg font-bold"
            :disabled="busyId === req.id"
            @click="openQuestionBox(req)"
          >
            💬 Ask 1 Question
          </button>
          <button
            type="button"
            class="btn btn-xs btn-primary rounded-lg font-black"
            :disabled="busyId === req.id"
            @click="promptDecision(req, 'approve')"
          >
            ✅ Approve &amp; Send Invite
          </button>
        </div>
      </div>

      <!-- Waitlisted Applicants (1-Click Promote to Invite) -->
      <div v-if="waitlistedRequests.length > 0" class="pt-1 space-y-1.5">
        <div class="text-[11px] font-bold uppercase tracking-wider text-base-content/60">
          Priority Waitlist (1-Click Promote When Space Opens)
        </div>
        <div
          v-for="req in waitlistedRequests"
          :key="req.id"
          class="rounded-xl border border-warning/30 bg-warning/5 px-3 py-2 flex flex-wrap items-center justify-between gap-2"
        >
          <div class="min-w-0">
            <span class="font-bold text-xs">{{ req.name }}</span>
            <span class="text-xs text-base-content/70 ml-1.5 break-all">({{ req.email }})</span>
          </div>
          <div class="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              class="btn btn-xs btn-primary rounded-lg font-bold"
              :disabled="busyId === req.id"
              @click="promptDecision(req, 'approve')"
            >
              ✅ Approve &amp; Send Invite
            </button>
            <button
              type="button"
              class="btn btn-xs btn-ghost text-base-content/60 rounded-lg"
              :disabled="busyId === req.id"
              @click="promptDecision(req, 'decline_silent')"
            >
              Remove
            </button>
          </div>
        </div>
      </div>

      <!-- Approved Invites Waiting for Account Creation -->
      <div v-if="approvedRequests.length > 0" class="pt-1 space-y-1.5">
        <div class="text-[11px] font-bold uppercase tracking-wider text-base-content/60">
          Approved Invites (Waiting to Create Password)
        </div>
        <div
          v-for="req in approvedRequests"
          :key="req.id"
          class="rounded-xl border border-success/30 bg-success/5 px-3 py-2 flex flex-wrap items-center justify-between gap-2"
        >
          <div class="min-w-0">
            <span class="font-bold text-xs">{{ req.name }}</span>
            <span class="text-xs text-base-content/70 ml-1.5 break-all">({{ req.email }})</span>
          </div>
          <div class="flex flex-wrap items-center gap-1.5">
            <button type="button" class="btn btn-xs btn-outline rounded-lg font-bold" @click="copyInviteLink(req)">
              Copy Invite Link
            </button>
            <button
              type="button"
              class="btn btn-xs btn-ghost rounded-lg font-bold"
              :disabled="busyId === req.id"
              @click="promptDecision(req, 'approve')"
            >
              Resend Invite Email
            </button>
            <button
              type="button"
              class="btn btn-xs btn-outline btn-info rounded-lg font-bold"
              :disabled="busyId === req.id"
              title="Move back to review queue without sending an email"
              @click="sendDecision(req, 'reopen')"
            >
              ↩️ Back to Review
            </button>
            <button
              type="button"
              class="btn btn-xs btn-ghost text-base-content/60 rounded-lg"
              :disabled="busyId === req.id"
              @click="promptDecision(req, 'decline_silent')"
            >
              Revoke
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Decision Confirmation Modal -->
    <dialog class="modal modal-bottom sm:modal-middle" :class="{ 'modal-open': !!pendingConfirm }">
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
import {
  JOIN_DECISION_TEMPLATES,
  JOIN_REQUEST_STATUS,
  type JoinDecisionKey,
  type JoinRequest,
  type JoinRequestStatus,
} from '../../lib/joinRequests';
import { joinApi } from '../../lib/joinRequestsClient';
import { siteConfig } from '../../site-config';

const allRequests = ref<JoinRequest[]>([]);
const unverifiedCount = ref(0);
const loading = ref(true);
const busyId = ref('');
const questionOpenForId = ref('');
const questionDraft = ref('');
const pendingConfirm = ref<{ req: JoinRequest; decision: JoinDecisionKey } | null>(null);
const currentOrigin = ref('');
const useProdOrigin = ref(false);

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
const approvedRequests = computed(() =>
  allRequests.value.filter((r) => r.status === JOIN_REQUEST_STATUS.approved)
);

const formatExternalUrl = (raw: string) => {
  const s = raw.trim();
  if (/^https?:\/\//i.test(s)) return s;
  if (s.startsWith('@')) return `https://instagram.com/${s.slice(1)}`;
  return `https://${s}`;
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
  questionOpenForId.value = req.id;
  questionDraft.value = req.stewardQuestion || 'What types of items or booth support are you looking to bring?';
};

const promptDecision = (req: JoinRequest, decision: JoinDecisionKey) => {
  questionOpenForId.value = '';
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
    if (decision === 'needs_info') {
      req.stewardQuestion = cleanQuestion;
      questionOpenForId.value = '';
    }

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
  if (typeof window !== 'undefined') {
    currentOrigin.value = window.location.origin;
  }
  load();
});
</script>

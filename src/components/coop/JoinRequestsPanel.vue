<template>
  <div
    v-if="loading || activeRequests.length > 0 || approvedRequests.length > 0 || waitlistedRequests.length > 0"
    class="card bg-base-100 border border-info/30 shadow-sm rounded-2xl"
  >
    <div class="p-4 space-y-3">
      <div class="flex flex-wrap items-center justify-between gap-2">
        <h3 class="font-black text-sm flex items-center gap-2">
          <Icon icon="solar:user-plus-bold-duotone" class="w-5 h-5 text-info shrink-0" />
          <span>Co-op Join Requests &amp; 1-Click Decisions</span>
          <span v-if="activeRequests.length > 0" class="badge badge-info badge-sm font-bold">{{ activeRequests.length }} waiting</span>
          <span v-if="approvedRequests.length > 0" class="badge badge-success badge-outline badge-sm font-bold">{{ approvedRequests.length }} invited</span>
          <span v-if="waitlistedRequests.length > 0" class="badge badge-warning badge-outline badge-sm font-bold">{{ waitlistedRequests.length }} waitlisted</span>
        </h3>
        <span v-if="loading" class="loading loading-spinner loading-xs"></span>
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
        <div v-if="questionOpenForId === req.id" class="flex flex-col sm:flex-row gap-2 pt-1">
          <input
            v-model="questionDraft"
            type="text"
            maxlength="280"
            placeholder="Ask 1 quick question (they answer on the site, not by email)..."
            class="input input-bordered input-xs rounded-lg flex-1 text-xs"
          />
          <button
            type="button"
            class="btn btn-xs btn-info rounded-lg font-bold"
            :disabled="busyId === req.id || !questionDraft.trim()"
            @click="sendDecision(req, 'needs_info', questionDraft)"
          >
            Send On-Page Question
          </button>
          <button type="button" class="btn btn-xs btn-ghost rounded-lg" @click="questionOpenForId = ''">
            Cancel
          </button>
        </div>

        <!-- 1-Click Automated Decision Bar (Zero Email Back-and-Forth) -->
        <div class="flex flex-wrap items-center justify-end gap-1.5 pt-1">
          <button
            type="button"
            class="btn btn-xs btn-ghost rounded-lg text-base-content/60"
            :disabled="busyId === req.id"
            title="Archive without sending any email"
            @click="sendDecision(req, 'decline_silent')"
          >
            Archive Silently
          </button>
          <button
            type="button"
            class="btn btn-xs btn-outline btn-error rounded-lg font-bold"
            :disabled="busyId === req.id"
            title="Sends polite 'Not a current category fit' template from the app"
            @click="sendDecision(req, 'decline_category')"
          >
            ✖ Decline (Category Fit)
          </button>
          <button
            type="button"
            class="btn btn-xs btn-outline rounded-lg font-bold"
            :disabled="busyId === req.id"
            title="Sends polite 'Booth / Roster at capacity' template from the app"
            @click="sendDecision(req, 'decline_capacity')"
          >
            ✖ Decline (Full Roster)
          </button>
          <button
            type="button"
            class="btn btn-xs btn-outline btn-warning rounded-lg font-bold"
            :disabled="busyId === req.id"
            title="Adds to waitlist & sends automated Waitlist email"
            @click="sendDecision(req, 'waitlist')"
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
            @click="sendDecision(req, 'approve')"
          >
            <span v-if="busyId === req.id" class="loading loading-spinner loading-xs"></span>
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
              @click="sendDecision(req, 'approve')"
            >
              ✅ Approve &amp; Send Invite
            </button>
            <button
              type="button"
              class="btn btn-xs btn-ghost text-base-content/60 rounded-lg"
              :disabled="busyId === req.id"
              @click="sendDecision(req, 'decline_silent')"
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
              @click="sendDecision(req, 'approve')"
            >
              Resend Invite Email
            </button>
            <button
              type="button"
              class="btn btn-xs btn-ghost text-base-content/60 rounded-lg"
              :disabled="busyId === req.id"
              @click="sendDecision(req, 'decline_silent')"
            >
              Revoke
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { Icon } from '@iconify/vue';
import { databases, Query } from '../../lib/appwrite';
import { siteConfig } from '../../site-config';
import { getDatabaseId } from '../../lib/appwriteEnv';
import { addToast } from '../../stores/toast';
import {
  JOIN_DECISION_TEMPLATES,
  JOIN_REQUEST_LOCATION_ID,
  JOIN_REQUEST_STATUS,
  buildInviteSignupUrl,
  parseJoinRequestDoc,
  serializeJoinRequestSnapshot,
  type JoinDecisionKey,
  type JoinRequest,
  type JoinRequestStatus,
} from '../../lib/joinRequests';

const MANIFESTS_COL_ID = 'manifests';

const allRequests = ref<JoinRequest[]>([]);
const loading = ref(true);
const busyId = ref('');
const questionOpenForId = ref('');
const questionDraft = ref('');

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

const getInviteUrl = (req: JoinRequest) => {
  const origin = typeof window !== 'undefined' ? window.location.origin : siteConfig.siteUrl;
  return buildInviteSignupUrl(req.id, origin);
};

const copyInviteLink = async (req: JoinRequest) => {
  const url = getInviteUrl(req);
  try {
    await navigator.clipboard.writeText(url);
    addToast({ type: 'success', message: `Copied invite link for ${req.name}!` });
  } catch {
    addToast({ type: 'info', message: url });
  }
};

const openQuestionBox = (req: JoinRequest) => {
  questionOpenForId.value = req.id;
  questionDraft.value = req.stewardQuestion || 'What types of items or booth support are you looking to bring?';
};

const load = async () => {
  try {
    const res = await databases.listDocuments(getDatabaseId(), MANIFESTS_COL_ID, [
      Query.equal('locationId', JOIN_REQUEST_LOCATION_ID),
      Query.orderDesc('$createdAt'),
      Query.limit(50),
    ]);
    allRequests.value = res.documents.map(parseJoinRequestDoc).filter((r): r is JoinRequest => !!r);
  } catch (err) {
    console.warn('[JoinRequestsPanel] Could not load join requests:', err);
  } finally {
    loading.value = false;
  }
};

const sendDecision = async (req: JoinRequest, decision: JoinDecisionKey, questionText = '') => {
  busyId.value = req.id;
  try {
    let nextStatus: JoinRequestStatus = JOIN_REQUEST_STATUS.approved;
    if (decision === 'waitlist') nextStatus = JOIN_REQUEST_STATUS.waitlisted;
    else if (decision === 'needs_info') nextStatus = JOIN_REQUEST_STATUS.needs_info;
    else if (decision.startsWith('decline_')) nextStatus = JOIN_REQUEST_STATUS.declined;

    const cleanQuestion = questionText.trim();
    const updatedSnap = serializeJoinRequestSnapshot({
      ...req,
      stewardQuestion: decision === 'needs_info' ? cleanQuestion : req.stewardQuestion,
      decisionKey: decision,
    });

    await databases.updateDocument(getDatabaseId(), MANIFESTS_COL_ID, req.id, {
      status: nextStatus,
      itemsSnapshot: updatedSnap,
    });

    req.status = nextStatus;
    if (decision === 'needs_info') {
      req.stewardQuestion = cleanQuestion;
      questionOpenForId.value = '';
    }

    if (decision === 'approve') {
      try {
        await navigator.clipboard.writeText(getInviteUrl(req));
      } catch {
        // Ignore clipboard errors
      }
    }

    // Trigger server-side automated template email via Porkbun SMTP
    fetch('/api/join-request', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'decide',
        id: req.id,
        decision,
        question: cleanQuestion,
      }),
    }).catch(() => {});

    if (decision === 'approve') {
      addToast({
        type: 'success',
        message: `Approved ${req.name}! Invite email sent & sign-up link copied.`,
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

onMounted(load);
</script>

<template>
  <div v-if="loading || pendingRequests.length > 0 || approvedRequests.length > 0" class="card bg-base-100 border border-info/30 shadow-sm rounded-2xl">
    <div class="p-4 space-y-3">
      <div class="flex flex-wrap items-center justify-between gap-2">
        <h3 class="font-black text-sm flex items-center gap-2">
          <Icon icon="solar:user-plus-bold-duotone" class="w-5 h-5 text-info shrink-0" />
          <span>Co-op Join Requests &amp; Active Invites</span>
          <span v-if="pendingRequests.length > 0" class="badge badge-info badge-sm font-bold">{{ pendingRequests.length }} waiting</span>
          <span v-if="approvedRequests.length > 0" class="badge badge-success badge-outline badge-sm font-bold">{{ approvedRequests.length }} invited</span>
        </h3>
        <span v-if="loading" class="loading loading-spinner loading-xs"></span>
      </div>

      <!-- Pending Join Requests -->
      <div v-for="req in pendingRequests" :key="req.id" class="rounded-xl border border-base-300 bg-base-200/40 p-3 space-y-2">
        <div class="flex flex-wrap items-start justify-between gap-2">
          <div class="min-w-0">
            <div class="font-bold text-sm break-words">{{ req.name }}</div>
            <div class="text-xs text-base-content/70 break-all">{{ req.email }}</div>
          </div>
          <div class="flex flex-wrap gap-1">
            <span v-for="hat in req.hats" :key="hat" class="badge badge-sm badge-outline">{{ hat }}</span>
          </div>
        </div>
        <p v-if="req.note" class="text-xs break-words whitespace-pre-line">{{ req.note }}</p>
        <div class="flex flex-wrap justify-end gap-2">
          <button type="button" class="btn btn-xs btn-ghost rounded-lg" :disabled="busyId === req.id" @click="decline(req)">Decline</button>
          <a
            :href="buildReplyMailto(req)"
            class="btn btn-xs btn-outline rounded-lg font-bold"
          >
            Reply by Email
          </a>
          <button type="button" class="btn btn-xs btn-primary rounded-lg font-bold" :disabled="busyId === req.id" @click="approve(req)">
            <span v-if="busyId === req.id" class="loading loading-spinner loading-xs"></span>
            Approve &amp; Send Invite
          </button>
        </div>
      </div>

      <!-- Approved Invites Waiting for Account Creation -->
      <div v-if="approvedRequests.length > 0" class="pt-1 space-y-1.5">
        <div class="text-[11px] font-bold uppercase tracking-wider text-base-content/60">
          Approved Invites (Waiting to Sign Up)
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
            <a :href="buildReplyMailto(req)" class="btn btn-xs btn-ghost rounded-lg font-bold">
              Email Link
            </a>
            <button type="button" class="btn btn-xs btn-ghost text-base-content/60 rounded-lg" :disabled="busyId === req.id" @click="decline(req)">
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
import { getDatabaseId } from '../../lib/appwriteEnv';
import { addToast } from '../../stores/toast';
import {
  JOIN_REQUEST_LOCATION_ID,
  JOIN_REQUEST_STATUS,
  buildInviteSignupUrl,
  parseJoinRequestDoc,
  type JoinRequest,
  type JoinRequestStatus,
} from '../../lib/joinRequests';

const MANIFESTS_COL_ID = 'manifests';

const allRequests = ref<JoinRequest[]>([]);
const loading = ref(true);
const busyId = ref('');

const pendingRequests = computed(() =>
  allRequests.value.filter((r) => r.status === JOIN_REQUEST_STATUS.pending)
);
const approvedRequests = computed(() =>
  allRequests.value.filter((r) => r.status === JOIN_REQUEST_STATUS.approved)
);

const getInviteUrl = (req: JoinRequest) => {
  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://resalecmd.com';
  return buildInviteSignupUrl(req.id, origin);
};

const buildReplyMailto = (req: JoinRequest) => {
  const inviteUrl = getInviteUrl(req);
  const subject = encodeURIComponent(`Your Invitation to The Huckleberry Collective (${req.hats.join(', ')})`);
  const body = encodeURIComponent(
    `Hi ${req.name},\n\nGreat news — your request to join The Huckleberry Collective (${req.hats.join(', ')}) has been approved!\n\nMembership is by invitation only. Use your personal invite link below to create your password and activate your account:\n${inviteUrl}\n\nWelcome aboard,\nThe Huckleberry Collective`
  );
  return `mailto:${encodeURIComponent(req.email)}?subject=${subject}&body=${body}`;
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

const setStatus = (req: JoinRequest, status: JoinRequestStatus) =>
  databases.updateDocument(getDatabaseId(), MANIFESTS_COL_ID, req.id, { status });

const approve = async (req: JoinRequest) => {
  busyId.value = req.id;
  try {
    await setStatus(req, JOIN_REQUEST_STATUS.approved);
    req.status = JOIN_REQUEST_STATUS.approved;

    const inviteUrl = getInviteUrl(req);
    try {
      await navigator.clipboard.writeText(inviteUrl);
    } catch {
      // Clipboard may not be available in all contexts
    }

    // Trigger server-side Porkbun SMTP invitation email
    fetch('/api/join-request', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'approve', id: req.id }),
    }).catch(() => {});

    addToast({
      type: 'success',
      message: `Approved ${req.name}! Invite emailed & personal sign-up link copied to clipboard.`,
    });
  } catch (err: any) {
    addToast({ type: 'error', message: err?.message || 'Could not approve the request.' });
  } finally {
    busyId.value = '';
  }
};

const decline = async (req: JoinRequest) => {
  busyId.value = req.id;
  try {
    await setStatus(req, JOIN_REQUEST_STATUS.declined);
    allRequests.value = allRequests.value.filter((r) => r.id !== req.id);
    addToast({ type: 'info', message: `Declined ${req.name}.` });
  } catch (err: any) {
    addToast({ type: 'error', message: err?.message || 'Could not update the request.' });
  } finally {
    busyId.value = '';
  }
};

onMounted(load);
</script>

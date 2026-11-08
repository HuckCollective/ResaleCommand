<template>
  <div v-if="canReview && (loading || requests.length > 0)" class="card bg-base-100 border border-info/30 shadow-sm rounded-2xl">
    <div class="p-4 space-y-3">
      <div class="flex flex-wrap items-center justify-between gap-2">
        <h3 class="font-black text-sm flex items-center gap-2">
          <Icon icon="solar:user-plus-bold-duotone" class="w-5 h-5 text-info shrink-0" />
          Join requests waiting
          <span class="badge badge-info badge-sm font-bold">{{ requests.length }}</span>
        </h3>
        <span v-if="loading" class="loading loading-spinner loading-xs"></span>
      </div>

      <div v-for="req in requests" :key="req.id" class="rounded-xl border border-base-300 bg-base-200/40 p-3 space-y-2">
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
            Approve &amp; Invite
          </button>
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
import { auth } from '../../lib/auth';
import { useAuth } from '../../composables/useAuth';
import { addToast } from '../../stores/toast';
import {
  JOIN_REQUEST_LOCATION_ID,
  JOIN_REQUEST_STATUS,
  parseJoinRequestDoc,
  type JoinRequest,
  type JoinRequestStatus,
} from '../../lib/joinRequests';

const MANIFESTS_COL_ID = 'manifests';

const { currentTeam, isAdmin } = useAuth();
const canReview = computed(() => !!isAdmin.value);

const requests = ref<JoinRequest[]>([]);
const loading = ref(true);
const busyId = ref('');

const buildReplyMailto = (req: JoinRequest) => {
  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://resalecmd.com';
  const subject = encodeURIComponent(`Welcome to The Huckleberry Collective (${req.hats.join(', ')})`);
  const body = encodeURIComponent(
    `Hi ${req.name},\n\nThanks for reaching out through our Co-op Charter! We reviewed your request (${req.hats.join(', ')}) and would love to connect.\n\nYou can create or sign in to your account here: ${origin}/login\n\nBest,\nThe Huckleberry Collective`
  );
  return `mailto:${encodeURIComponent(req.email)}?subject=${subject}&body=${body}`;
};

const load = async () => {
  try {
    const res = await databases.listDocuments(getDatabaseId(), MANIFESTS_COL_ID, [
      Query.equal('locationId', JOIN_REQUEST_LOCATION_ID),
      Query.equal('status', JOIN_REQUEST_STATUS.pending),
      Query.orderDesc('$createdAt'),
      Query.limit(50),
    ]);
    requests.value = res.documents.map(parseJoinRequestDoc).filter((r): r is JoinRequest => !!r);
  } catch (err) {
    console.warn('[JoinRequestsPanel] Could not load join requests:', err);
  } finally {
    loading.value = false;
  }
};

const setStatus = (req: JoinRequest, status: JoinRequestStatus) =>
  databases.updateDocument(getDatabaseId(), MANIFESTS_COL_ID, req.id, { status });

const approve = async (req: JoinRequest) => {
  const teamId = currentTeam.value?.$id;
  busyId.value = req.id;
  try {
    if (teamId) {
      try {
        await auth.inviteMember(teamId, req.email);
      } catch (inviteErr: any) {
        // Ignore 409 if the email is already a member of this team (e.g. testing with admin email)
        if (!String(inviteErr?.message || '').toLowerCase().includes('already') && inviteErr?.code !== 409) {
          console.warn('[JoinRequestsPanel] inviteMember warning:', inviteErr?.message || inviteErr);
        }
      }
    }
    await setStatus(req, JOIN_REQUEST_STATUS.approved);
    requests.value = requests.value.filter((r) => r.id !== req.id);
    addToast({ type: 'success', message: `Approved ${req.name}!` });
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
    requests.value = requests.value.filter((r) => r.id !== req.id);
    addToast({ type: 'info', message: `Declined ${req.name}.` });
  } catch (err: any) {
    addToast({ type: 'error', message: err?.message || 'Could not update the request.' });
  } finally {
    busyId.value = '';
  }
};

onMounted(load);
</script>

<template>
  <div class="flex min-h-screen items-center justify-center bg-base-200 px-4 py-12 sm:px-6 lg:px-8">
    <div class="card w-full max-w-lg bg-base-100 shadow-2xl border border-base-300 rounded-3xl">
      <div class="card-body p-6 sm:p-8 space-y-4">
        <div class="text-center space-y-1">
          <div class="badge badge-primary badge-outline font-bold text-xs">
            {{ hasValidInvite ? '✅ Invitation Verified' : '🤝 Invite-Only Cooperative' }}
          </div>
          <h2 class="text-2xl sm:text-3xl font-black tracking-tight">
            {{ hasValidInvite ? 'Create your Co-op Account' : needsInfoInvite ? 'Quick Question on Your Application' : 'Request an Invitation' }}
          </h2>
          <p v-if="!hasValidInvite && !needsInfoInvite && !checkingInvite" class="text-xs sm:text-sm text-base-content/70">
            Accounts at The Huckleberry Collective are created by invitation only. Tell us which hat fits you below and a steward will review your request right inside the app.
          </p>
        </div>

        <!-- Checking invite spinner -->
        <div v-if="checkingInvite" class="flex flex-col items-center justify-center py-8 gap-2">
          <span class="loading loading-spinner loading-md text-primary"></span>
          <span class="text-xs text-base-content/70">Checking your invitation status...</span>
        </div>

        <!-- ON-PAGE Q&A PORTAL (When steward clicked 'Ask 1 Question') -->
        <div v-else-if="needsInfoInvite" class="rounded-2xl border border-info/40 bg-info/5 p-4 space-y-3">
          <div class="text-xs font-bold text-info uppercase tracking-wider">
            Message from a Co-op Steward for {{ needsInfoInvite.name }}
          </div>
          <p class="text-sm font-bold text-base-content">
            "{{ needsInfoInvite.stewardQuestion || 'Could you share a bit more detail about what you curate or want to help with?' }}"
          </p>
          <textarea
            v-model="applicantReplyDraft"
            maxlength="500"
            class="textarea textarea-bordered rounded-xl text-xs w-full h-24"
            placeholder="Type your answer here (no email needed)..."
          ></textarea>
          <div class="flex justify-end">
            <button
              type="button"
              class="btn btn-sm btn-primary rounded-xl font-black"
              :disabled="replyBusy || !applicantReplyDraft.trim()"
              @click="submitApplicantReply"
            >
              <span v-if="replyBusy" class="loading loading-spinner loading-xs"></span>
              Send Answer to Co-op Stewards
            </button>
          </div>
        </div>

        <!-- Pending / Waitlisted / Declined status banner -->
        <div v-else-if="inviteStatusMsg" class="alert alert-info text-xs rounded-2xl">
          <span>{{ inviteStatusMsg }}</span>
        </div>

        <!-- WITHOUT INVITE: Embedded Request-an-Invite (ConnectWithUsForm) -->
        <div v-if="!checkingInvite && !hasValidInvite && !needsInfoInvite" class="space-y-4">
          <ConnectWithUsForm :hats="hatOptions" @close="goToLogin" />

          <div class="divider text-xs text-base-content/50 my-1">Already have an invite link or code?</div>

          <div class="flex flex-col sm:flex-row gap-2">
            <input
              v-model="manualInviteInput"
              type="text"
              placeholder="Paste invite link or code (join_...)"
              class="input input-bordered input-sm rounded-xl flex-1 text-xs"
            />
            <button type="button" class="btn btn-sm btn-outline rounded-xl font-bold" @click="applyManualInvite">
              Check / Unlock
            </button>
          </div>

          <div class="text-center pt-1 flex flex-wrap items-center justify-center gap-4 text-xs">
            <a :href="loginLink" class="link link-primary font-bold">Already a member? Sign in →</a>
            <a href="/coop" class="link link-hover text-base-content/70">Read the Collective Charter</a>
          </div>
        </div>

        <!-- WITH VALID INVITE: Create Account Form -->
        <form v-if="!checkingInvite && hasValidInvite" @submit.prevent="submit" class="space-y-4">
          <div v-if="approvedInvite" class="rounded-2xl bg-success/10 border border-success/30 p-3 text-xs space-y-1">
            <div class="font-bold text-success">
              Approved Invitation for {{ approvedInvite.name }}
            </div>
            <div class="flex flex-wrap gap-1 pt-0.5">
              <span v-for="hat in approvedInvite.hats" :key="hat" class="badge badge-xs badge-success badge-outline font-bold">
                {{ hat }}
              </span>
            </div>
          </div>

          <div class="form-control w-full">
            <label class="label py-1">
              <span class="label-text font-bold text-xs">Full Name</span>
            </label>
            <input
              type="text"
              v-model="name"
              required
              placeholder="Jane Doe"
              class="input input-bordered w-full rounded-xl"
            />
          </div>

          <div class="form-control w-full">
            <label class="label py-1">
              <span class="label-text font-bold text-xs">Invited Email Address</span>
            </label>
            <input
              type="email"
              v-model="email"
              required
              :readonly="!!approvedInvite"
              placeholder="you@example.com"
              class="input input-bordered w-full rounded-xl"
              :class="{ 'bg-base-200/70 cursor-not-allowed': !!approvedInvite }"
            />
          </div>

          <div class="form-control w-full">
            <label class="label py-1">
              <span class="label-text font-bold text-xs">Choose a Password (min 8 characters)</span>
            </label>
            <input
              type="password"
              v-model="password"
              required
              minlength="8"
              placeholder="••••••••"
              class="input input-bordered w-full rounded-xl"
            />
          </div>

          <div class="flex items-center justify-between text-xs mt-2">
            <a :href="loginLink" class="link link-primary link-hover font-bold">Already have an account? Sign in</a>
          </div>

          <div class="form-control mt-4">
            <button
              type="submit"
              class="btn btn-primary w-full rounded-xl font-black"
              :disabled="loading"
            >
              <span v-if="loading" class="loading loading-spinner loading-sm"></span>
              <span v-else>Accept Invite &amp; Create Account</span>
            </button>
          </div>

          <div v-if="error" class="alert alert-error shadow-lg mt-3 text-xs p-3 rounded-xl">
            <span>{{ error }}</span>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useAuth } from '../../composables/useAuth';
import { databases } from '../../lib/appwrite';
import { getDatabaseId } from '../../lib/appwriteEnv';
import ConnectWithUsForm from '../coop/ConnectWithUsForm.vue';
import {
  JOIN_REQUEST_HAT_OPTIONS,
  JOIN_REQUEST_STATUS,
  parseJoinRequestDoc,
  serializeJoinRequestSnapshot,
  type JoinRequest,
} from '../../lib/joinRequests';

const auth = useAuth();
const hatOptions = JOIN_REQUEST_HAT_OPTIONS;

const name = ref('');
const email = ref('');
const password = ref('');
const loading = ref(false);
const error = ref('');

const checkingInvite = ref(true);
const hasTeamRedirectInvite = ref(false);
const approvedInvite = ref<JoinRequest | null>(null);
const needsInfoInvite = ref<JoinRequest | null>(null);
const applicantReplyDraft = ref('');
const replyBusy = ref(false);
const inviteStatusMsg = ref('');
const manualInviteInput = ref('');

const hasValidInvite = computed(() => hasTeamRedirectInvite.value || !!approvedInvite.value);

const loginLink = computed(() => {
  if (typeof window !== 'undefined') {
    return '/login' + window.location.search;
  }
  return '/login';
});

const goToLogin = () => {
  if (typeof window !== 'undefined') {
    window.location.href = '/login';
  }
};

const verifyInviteCode = async (rawCode: string) => {
  const clean = rawCode.trim();
  if (!clean) return;
  checkingInvite.value = true;
  inviteStatusMsg.value = '';
  approvedInvite.value = null;
  needsInfoInvite.value = null;
  try {
    const doc = await databases.getDocument(getDatabaseId(), 'manifests', clean);
    const parsed = parseJoinRequestDoc(doc);
    if (!parsed) {
      inviteStatusMsg.value = 'That invite code was not found. Request an invitation below.';
      return;
    }
    if (parsed.status === JOIN_REQUEST_STATUS.approved) {
      approvedInvite.value = parsed;
      name.value = parsed.name;
      email.value = parsed.email;
    } else if (parsed.status === JOIN_REQUEST_STATUS.needs_info) {
      needsInfoInvite.value = parsed;
      applicantReplyDraft.value = parsed.applicantReply || '';
    } else if (parsed.status === JOIN_REQUEST_STATUS.waitlisted) {
      inviteStatusMsg.value = `Hi ${parsed.name} — your application is on our Priority Waitlist while booth shelf space is full. We'll automatically email your invite link as soon as a spot opens!`;
    } else if (parsed.status === JOIN_REQUEST_STATUS.pending) {
      inviteStatusMsg.value = `Hi ${parsed.name} — your request is in our Co-op Governance queue and waiting for steward review. We'll send an automated update as soon as a steward reviews it!`;
    } else if (parsed.status === JOIN_REQUEST_STATUS.joined) {
      inviteStatusMsg.value = 'This invitation has already been used to create an account. Please sign in!';
    } else {
      inviteStatusMsg.value = 'Thank you for your interest in The Huckleberry Collective. Our current roster and category mix are full at this time.';
    }
  } catch {
    inviteStatusMsg.value = 'Could not find that invitation code. You can request a fresh invitation below.';
  } finally {
    checkingInvite.value = false;
  }
};

const submitApplicantReply = async () => {
  if (!needsInfoInvite.value || !applicantReplyDraft.value.trim()) return;
  replyBusy.value = true;
  try {
    const req = needsInfoInvite.value;
    const cleanReply = applicantReplyDraft.value.trim().slice(0, 500);
    const updatedSnap = serializeJoinRequestSnapshot({
      ...req,
      applicantReply: cleanReply,
    });
    await databases.updateDocument(getDatabaseId(), 'manifests', req.id, {
      status: JOIN_REQUEST_STATUS.pending,
      itemsSnapshot: updatedSnap,
    });
    needsInfoInvite.value = null;
    inviteStatusMsg.value = 'Thank you! Your answer has been sent straight to our Co-op Governance queue.';
  } catch (err: any) {
    inviteStatusMsg.value = err?.message || 'Could not save your reply. Please try again.';
  } finally {
    replyBusy.value = false;
  }
};

const applyManualInvite = async () => {
  const raw = manualInviteInput.value.trim();
  if (!raw) return;
  const match = raw.match(/join_[a-f0-9]+/i);
  const code = match ? match[0] : raw;
  await verifyInviteCode(code);
};

onMounted(async () => {
  const params = new URLSearchParams(window.location.search);
  const redirect = params.get('redirect') || '';
  const inviteParam = params.get('invite') || '';

  if (redirect.includes('/join')) {
    hasTeamRedirectInvite.value = true;
    checkingInvite.value = false;
    return;
  }

  if (inviteParam) {
    await verifyInviteCode(inviteParam);
  } else {
    checkingInvite.value = false;
  }
});

const submit = async () => {
  if (!hasValidInvite.value) {
    error.value = 'An approved invitation is required to create an account.';
    return;
  }
  loading.value = true;
  error.value = '';
  try {
    await auth.register(email.value, password.value, name.value);

    if (approvedInvite.value) {
      try {
        await databases.updateDocument(getDatabaseId(), 'manifests', approvedInvite.value.id, {
          status: JOIN_REQUEST_STATUS.joined,
        });
      } catch {
        // Non-blocking status update
      }
    }

    const urlParams = new URLSearchParams(window.location.search);
    const redirect = urlParams.get('redirect');
    window.location.href = redirect || '/dashboard';
  } catch (err: any) {
    console.error(err);
    error.value = err.message || 'Registration failed. Please try again.';
  } finally {
    loading.value = false;
  }
};
</script>
